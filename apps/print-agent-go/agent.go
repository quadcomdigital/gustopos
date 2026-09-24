package main

import (
	"context"
	"encoding/base64"
	"fmt"
	"log"
	"runtime/debug"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// stagedUpdate channel is created by main; the agent only sends on it.
// (type stagedUpdate is defined in updater.go)

// Agent runs the print-bridge lifecycle on the POS machine. It talks
// directly to the API (no browser, no JWT): the 6-digit pairing code is the
// credential, and the server ties every poll to the tenant that claimed us.
type Agent struct {
	cfg     *Config
	api     *API
	qz      *QZClient
	runtime *AgentRuntime

	heartbeatEvery     time.Duration
	claimEvery         time.Duration
	fiscalClaimEvery   time.Duration
	claimBatch         int
	printTimeout       time.Duration
	discoveredPrinters []string
	// Network printers found by the last LAN scan. Cached so every heartbeat
	// keeps reporting them (the server overwrites the list on each heartbeat).
	mu         sync.Mutex
	netDevices []DiscoveredDevice
	// lastCommandID dedupes one-shot commands delivered again after a lost ack.
	lastCommandID string
	// Throttles the "fiscal claim skipped" log to state changes only.
	lastFiscalSkipAreas string
	// Cursor of the last log entry shipped to the API (diagnostics).
	lastShippedSeq int64
	// lastHeartbeatUnix lets an external watchdog detect a stalled agent.
	lastHeartbeatUnix atomic.Int64
	// updateReady receives a staged update for main to install and restart.
	updateReady  chan<- stagedUpdate
	updateStaged atomic.Bool
}

func NewAgent(cfg *Config, runtime *AgentRuntime, updateReady chan<- stagedUpdate) (*Agent, error) {
	api := NewAPI(cfg.APIBase, "", cfg.Code, cfg.InstanceID)
	// Persist the canonical origin on the next config save so legacy
	// installations no longer reintroduce /api and the certificate 404.
	cfg.APIBase = api.Base
	if err := cfg.Save(); err != nil {
		log.Printf("could not persist canonical API origin: %v", err)
	}
	saveIdentity(cfg.BridgeID, cfg.InstanceID)
	cachedPrinters := append([]string(nil), cfg.DiscoveredPrinters...)
	agent := &Agent{
		cfg:                cfg,
		api:                api,
		runtime:            runtime,
		heartbeatEvery:     30 * time.Second,
		claimEvery:         3 * time.Second,
		fiscalClaimEvery:   5 * time.Second,
		claimBatch:         10,
		printTimeout:       30 * time.Second,
		discoveredPrinters: cachedPrinters,
		updateReady:        updateReady,
	}
	agent.lastHeartbeatUnix.Store(time.Now().Unix())
	return agent, nil
}

// LastHeartbeatUnix returns when the last successful heartbeat happened.
func (a *Agent) LastHeartbeatUnix() int64 {
	return a.lastHeartbeatUnix.Load()
}

// printerCapabilities merges the QZ-installed printers with the network
// printers found by the last LAN scan so the server always receives the full
// picture on each heartbeat.
func (a *Agent) printerCapabilities() []BridgePrinterCapability {
	caps := make([]BridgePrinterCapability, 0, len(a.discoveredPrinters))
	for _, name := range a.discoveredPrinters {
		if name = strings.TrimSpace(name); name != "" {
			caps = append(caps, BridgePrinterCapability{Name: name, Source: "qz"})
		}
	}
	a.mu.Lock()
	devices := append([]DiscoveredDevice(nil), a.netDevices...)
	a.mu.Unlock()
	for _, device := range devices {
		name := device.Vendor
		if name == "" {
			name = "Stampante di rete"
		}
		caps = append(caps, BridgePrinterCapability{
			Name:   name + " (" + device.IP + ")",
			IP:     device.IP,
			Port:   device.Port,
			Source: "net",
			Vendor: device.Vendor,
		})
	}
	return caps
}

// setNetDevices replaces the cached discovery result.
func (a *Agent) setNetDevices(devices []DiscoveredDevice) {
	a.mu.Lock()
	a.netDevices = append([]DiscoveredDevice(nil), devices...)
	a.mu.Unlock()
}

// runDiscovery scans the LAN and reports the result. It runs off the heartbeat
// goroutine so a slow scan never delays printing; the cached result is then
// included in every subsequent heartbeat.
func (a *Agent) runDiscovery(ctx context.Context) {
	defer recoverPanic("discovery")
	devices := DiscoverNetworkDevices(ctx)
	a.setNetDevices(devices)
	if err := a.api.ReportDiscoveredDevices(a.cfg.BridgeID, devices); err != nil {
		log.Printf("network discovery: could not report %d device(s): %v", len(devices), err)
		return
	}
	log.Printf("network discovery: reported %d device(s) to the server", len(devices))
}

// maybeExecuteCommand runs a one-shot command delivered in the heartbeat
// response exactly once (per command id) and acks it to the server.
func (a *Agent) maybeExecuteCommand(ctx context.Context, command *BridgeCommand) {
	if command == nil || command.ID == "" {
		return
	}
	a.mu.Lock()
	if a.lastCommandID == command.ID {
		a.mu.Unlock()
		return
	}
	a.lastCommandID = command.ID
	a.mu.Unlock()

	go func() {
		defer recoverPanic("command")
		a.executeCommand(ctx, command)
		if err := a.api.AckCommand(a.cfg.BridgeID, command.ID); err != nil {
			log.Printf("command %s (%s) ack failed: %v", command.ID, command.Type, err)
		}
	}()
}

func (a *Agent) executeCommand(ctx context.Context, command *BridgeCommand) {
	switch command.Type {
	case "scan":
		a.runDiscovery(ctx)
	case "test-print":
		port := command.Port
		if port <= 0 {
			port = discoveryPort
		}
		label := strings.TrimSpace(command.Label)
		if label == "" {
			label = fmt.Sprintf("%s:%d", command.IP, port)
		}
		log.Printf("command: test print to %s:%d", command.IP, port)
		if err := PrintRawTCP(command.IP, port, escposTestTicket(label), a.printTimeout); err != nil {
			log.Printf("command: test print to %s:%d failed: %v", command.IP, port, err)
		}
	case "update":
		if err := a.checkForUpdate(); err != nil {
			log.Printf("command: update failed: %v", err)
		}
	default:
		log.Printf("command: unknown type %q", command.Type)
	}
}

// ensureQZ connects to QZ Tray, fetching the signing certificate on first use.
// If the connection was dropped (QZ Tray restarted, PC woke up, ...) it
// recreates the client so printing keeps working without a process restart.
//
// Before dialling it runs the local preflight: QZ Tray never explains itself
// (it just opens the access dialog and our handshake times out after 15s with
// a generic message), while every reason is readable on this machine. Failing
// fast turns "non scrivibile / non valido" into a specific instruction.
func (a *Agent) ensureQZ() error {
	if a.qz != nil && a.qz.Connected() {
		a.setQZ(true)
		return nil
	}
	// Discard the stale client (its readLoop already closed the socket).
	if a.qz != nil {
		a.qz.Close()
		a.qz = nil
	}
	report := a.RunPreflight()
	if !report.OK {
		a.setQZ(false)
		return fmt.Errorf("QZ preflight: %s", report.Blocking)
	}
	url := fmt.Sprintf("ws://localhost:%d", a.cfg.QZPort)
	if a.cfg.QZSecure {
		url = fmt.Sprintf("wss://localhost:%d", a.cfg.QZPort)
	}
	qz := NewQZClient(url, report.CertPEM, a.api.SignQzMessage)
	if err := qz.Connect(); err != nil {
		a.setQZ(false)
		return err
	}
	a.qz = qz
	a.setQZ(true)
	log.Printf("connected to QZ Tray at %s", url)
	return nil
}

// RunPreflight validates the tenant's certificate against this machine's QZ
// Tray installation without opening a connection, and publishes the report to
// the dashboard and the server-side diagnostics (Settings → Stampa).
func (a *Agent) RunPreflight() PreflightReport {
	cert, certErr := a.api.FetchCertificate()
	if certErr != nil {
		report := PreflightReport{
			OK:        false,
			CheckedAt: time.Now(),
			Blocking:  "fetch signing certificate: " + certErr.Error(),
			Checks: []PreflightCheck{{
				Name: checkCertificate, OK: false, Blocking: true,
				Detail: "cannot fetch /signing/digital-certificate.txt: " + certErr.Error(),
				Fix:    "check the server URL in the pairing page and the network",
			}},
		}
		a.setPreflight(report)
		log.Printf("QZ preflight FAILED: %s", report.Blocking)
		return report
	}

	// The anchor is best effort: when it cannot be fetched the preflight still
	// validates the local override.crt on its own.
	rootPEM, _ := a.api.FetchRootCA()
	report := newPreflight(cert, rootPEM).Run()
	a.setPreflight(report)
	if !report.OK {
		// The ring log is the stdlib log sink, so these lines reach the
		// server's diagnostics (Settings → Stampa) with the next push.
		log.Printf("QZ preflight FAILED: %s", report.Blocking)
		for _, check := range report.Checks {
			if check.OK || !check.Blocking {
				continue
			}
			log.Printf("  - %s: %s", check.Name, check.Detail)
			if check.Fix != "" {
				log.Printf("    fix: %s", check.Fix)
			}
		}
	} else if report.Healed != "" {
		log.Printf("QZ preflight: %s", report.Healed)
	}
	return report
}

// LastPreflight returns the last report (nil when never run).
func (a *Agent) LastPreflight() *PreflightReport {
	if a.runtime == nil {
		return nil
	}
	return a.runtime.Status.GetPreflight()
}

func (a *Agent) setPreflight(report PreflightReport) {
	if a.runtime != nil {
		a.runtime.Status.SetPreflight(report)
	}
}

func (a *Agent) setQZ(connected bool) {
	if a.runtime != nil {
		a.runtime.Status.SetQZConnected(connected)
	}
}

// ReconnectQZ forces a fresh QZ Tray connection + printer discovery. Used by
// the local dashboard when QZ Tray was restarted on the POS machine.
func (a *Agent) ReconnectQZ() {
	if a.qz != nil {
		a.qz.Close()
		a.qz = nil
	}
	if err := a.ensureQZ(); err != nil {
		log.Printf("dashboard QZ reconnect failed: %v", err)
	}
	a.discoverPrinters()
}

// TestPrint sends a tiny ESC/POS ticket to the printer mapped to `area`, so an
// operator can verify the area→printer mapping without a real order.
func (a *Agent) TestPrint(area string) error {
	target, ok := a.cfg.targetFor(area)
	if !ok {
		return fmt.Errorf("no printer mapping configured for area %q", area)
	}
	return a.dispatchPrint(target, escposTestTicket(targetLabel(target, area)))
}

// targetLabel is a human-readable identifier for a test ticket so an operator
// can physically recognise which printer received it.
func targetLabel(target PrinterTarget, area string) string {
	if target.isNetwork() {
		port := target.Port
		if port <= 0 {
			port = 9100
		}
		return fmt.Sprintf("%s @ %s:%d", area, target.IP, port)
	}
	return area
}

func escposTestTicket(area string) string {
	var b strings.Builder
	b.WriteString("\x1b@")     // initialise
	b.WriteString("\x1ba\x01") // centre
	b.WriteString("GUSTOPOS TEST STAMPA\n")
	b.WriteString("Area: " + area + "\n")
	b.WriteString(time.Now().Format("2006-01-02 15:04:05") + "\n\n\n")
	b.WriteString("\x1dV\x00") // cut
	return base64.StdEncoding.EncodeToString([]byte(b.String()))
}

// Run blocks until ctx is cancelled, the agent stops, or the credential is
// revoked. It closes QZ on every exit so tray-triggered shutdown is clean.
// Returns errDetachedSentinel when the API rejects us with 401 (the admin
// detached the bridge in Settings) so the caller can re-trigger pairing.
var errDetachedSentinel = fmt.Errorf("bridge detached")

func (a *Agent) Run(ctx context.Context) (err error) {
	defer func() {
		if a.qz != nil {
			a.qz.Close()
			a.qz = nil
		}
	}()
	// A panic must not kill the process: log the stack and let the supervisor
	// restart the agent with backoff.
	defer func() {
		if r := recover(); r != nil {
			log.Printf("panic in agent run: %v\n%s", r, debug.Stack())
			err = fmt.Errorf("agent panic: %v", r)
		}
	}()
	// QZ discovery is best-effort: the API heartbeat must still run when QZ
	// Tray is starting or temporarily unavailable.
	_ = a.ensureQZ()
	a.discoverPrinters()
	if a.runtime != nil {
		a.runtime.Status.SetConfig(a.cfg)
	}

	// First heartbeat also performs the bind if this is a fresh pairing.
	if response, err := a.api.Heartbeat(a.cfg, a.printerCapabilities()); err != nil {
		if IsDetached(err) {
			return errDetachedSentinel
		}
		log.Printf("initial heartbeat failed (will retry): %v", err)
		if a.runtime != nil {
			a.runtime.Status.RecordError(err.Error())
		}
	} else {
		a.applyHeartbeatConfig(response)
		a.markHeartbeat()
		a.maybeExecuteCommand(ctx, response.Command)
	}
	a.shipDiagnostics()
	// Best-effort startup update check (never blocks printing).
	go func() {
		defer recoverPanic("update-check")
		if err := a.checkForUpdate(); err != nil {
			log.Printf("update check failed: %v", err)
		}
	}()

	hb := time.NewTicker(a.heartbeatEvery)
	defer hb.Stop()
	cl := time.NewTicker(a.claimEvery)
	defer cl.Stop()
	fc := time.NewTicker(a.fiscalClaimEvery)
	defer fc.Stop()
	upd := time.NewTicker(a.cfg.updateCheckInterval())
	defer upd.Stop()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-hb.C:
			// Liveness is the loop itself, not server reachability: mark the
			// attempt so a network/server outage never triggers the watchdog.
			a.lastHeartbeatUnix.Store(time.Now().Unix())
			a.discoverPrinters()
			if response, err := a.api.Heartbeat(a.cfg, a.printerCapabilities()); err != nil {
				if IsDetached(err) {
					return errDetachedSentinel
				}
				log.Printf("heartbeat failed: %v", err)
				if a.runtime != nil {
					a.runtime.Status.RecordError(err.Error())
				}
			} else {
				a.applyHeartbeatConfig(response)
				a.markHeartbeat()
				a.maybeExecuteCommand(ctx, response.Command)
			}
			a.shipDiagnostics()
		case <-cl.C:
			if err := a.claimOnce(); err != nil {
				if err == errDetachedSentinel {
					return err
				}
			}
		case <-fc.C:
			// Certified fiscal jobs are pulled on their own cadence so a slow RT
			// device never delays kitchen/bar ticket printing.
			if err := a.claimFiscalOnce(); err != nil {
				if err == errDetachedSentinel {
					return err
				}
			}
		case <-upd.C:
			if err := a.checkForUpdate(); err != nil {
				log.Printf("update check failed: %v", err)
			}
		}
	}
}

// discoverPrinters refreshes the transient local capability list. The last
// successful result is retained across temporary QZ failures so the admin UI
// does not lose its options during a reconnect.
func (a *Agent) discoverPrinters() {
	if a.qz == nil || !a.qz.Connected() {
		if err := a.ensureQZ(); err != nil {
			log.Printf("printer discovery deferred: %v", err)
			return
		}
	}
	printers, err := a.qz.FindPrinters(3 * time.Second)
	if err != nil {
		log.Printf("printer discovery failed (keeping last result): %v", err)
		return
	}
	seen := make(map[string]struct{}, len(printers))
	a.discoveredPrinters = a.discoveredPrinters[:0]
	for _, printer := range printers {
		printer = strings.TrimSpace(printer)
		if printer == "" {
			continue
		}
		if _, ok := seen[printer]; ok {
			continue
		}
		seen[printer] = struct{}{}
		a.discoveredPrinters = append(a.discoveredPrinters, printer)
	}
	sort.Strings(a.discoveredPrinters)
	a.cfg.DiscoveredPrinters = append([]string(nil), a.discoveredPrinters...)
	if a.runtime != nil {
		a.runtime.Status.SetPrinters(a.discoveredPrinters)
	}
	if err := a.cfg.Save(); err != nil {
		log.Printf("could not persist discovered printers: %v", err)
	}
	log.Printf("discovered %d local printer(s) via QZ Tray", len(a.discoveredPrinters))
}

// markHeartbeat refreshes the dashboard snapshot after an authoritative
// server config was applied (canonical bridge id, areas, mappings).
func (a *Agent) markHeartbeat() {
	a.lastHeartbeatUnix.Store(time.Now().Unix())
	if a.runtime == nil {
		return
	}
	a.runtime.Status.SetConfig(a.cfg)
	a.runtime.Status.MarkHeartbeat()
}

// shipDiagnostics pushes any logs accumulated since the last successful push,
// plus the current health snapshot, to the API. Failures are non-fatal and
// leave the cursor untouched so entries are retried on the next heartbeat.
func (a *Agent) shipDiagnostics() {
	if a.runtime == nil || a.api == nil || a.cfg == nil || !a.cfg.IsPaired() {
		return
	}
	entries, latest := a.runtime.Logs.Since(a.lastShippedSeq)
	status := a.runtime.Status.Snapshot()

	logs := make([]DiagnosticsLogEntry, 0, len(entries))
	for _, entry := range entries {
		logs = append(logs, DiagnosticsLogEntry{
			Timestamp: entry.Timestamp,
			Level:     entry.Level,
			Component: entry.Component,
			Message:   entry.Message,
		})
	}

	if err := a.api.PushDiagnostics(a.cfg, logs, status.LastError); err != nil {
		if !IsDetached(err) {
			log.Printf("diagnostics push failed (will retry): %v", err)
		}
		return
	}
	a.lastShippedSeq = latest
}

// claimOnce pulls pending jobs for this bridge and prints them.
// Returns errDetachedSentinel if the API rejected our credential (401).
func (a *Agent) claimOnce() error {
	jobs, err := a.api.Claim(a.cfg.BridgeID, a.claimBatch)
	if err != nil {
		if IsDetached(err) {
			return errDetachedSentinel
		}
		log.Printf("claim failed: %v", err)
		return nil
	}
	if a.runtime != nil {
		a.runtime.Status.MarkClaim()
	}
	for _, job := range jobs {
		a.processJob(job)
	}
	return nil
}

// recordJob keeps the local job history (shown by the dashboard and shipped in
// the diagnostics bundle) in sync with the outcome of a job.
func (a *Agent) recordJob(job PrintJob, status, errMsg string, started time.Time) {
	if a.runtime == nil {
		return
	}
	switch status {
	case "printed":
		a.runtime.Status.RecordPrinted()
	case "failed":
		a.runtime.Status.RecordFailed(errMsg)
	}
	a.runtime.Jobs.Add(JobRecord{
		JobID:      job.ID,
		OrderID:    job.OrderID,
		Area:       job.Area,
		Status:     status,
		Error:      errMsg,
		Timestamp:  time.Now().UTC().Format(time.RFC3339),
		DurationMs: time.Since(started).Milliseconds(),
	})
}

// applyHeartbeatConfig makes the API's administrative bridge configuration
// authoritative for the Go agent. The API returns claimedAreas and mappings
// separately from the heartbeat-reported capabilities in areas/printers.
func (a *Agent) applyHeartbeatConfig(response *HeartbeatResponse) {
	if response == nil {
		return
	}
	if response.Bridge.ID != "" && response.Bridge.ID != a.cfg.BridgeID {
		log.Printf("bridge id canonicalized by server: %s -> %s", a.cfg.BridgeID, response.Bridge.ID)
		a.cfg.BridgeID = response.Bridge.ID
		saveIdentity(a.cfg.BridgeID, a.cfg.InstanceID)
	}
	if response.Bridge.ClaimedAreas != nil {
		a.cfg.Areas = append([]string(nil), response.Bridge.ClaimedAreas...)
	}
	if response.Bridge.Mappings != nil {
		targets := make(map[string]PrinterTarget, len(response.Bridge.Mappings))
		for _, mapping := range response.Bridge.Mappings {
			if mapping.Area == "" {
				continue
			}
			if mapping.IP != "" {
				// Network printer: raw TCP, independent of QZ/driver state.
				targets[mapping.Area] = PrinterTarget{Type: "tcp", IP: mapping.IP, Port: mapping.Port}
			} else if mapping.Name != "" {
				targets[mapping.Area] = PrinterTarget{Type: "qz", Name: mapping.Name}
			}
		}
		// The server owns the mappings: replace the local view entirely so a
		// cleared mapping cannot fall back to a stale local QZ name.
		a.cfg.PrinterTargets = targets
		a.cfg.PrinterNames = map[string]string{}
	}
	// Certified fiscal (Path B): the server is the source of truth for the RT
	// device config saved in the web UI. Apply it over the local config so the
	// admin never has to touch the agent's config file.
	if response.FiscalPrinter != nil && response.FiscalPrinter.Host != "" {
		local := a.cfg.FiscalPrinter
		if local == nil {
			local = &FiscalPrinter{}
		}
		server := response.FiscalPrinter
		local.Enabled = server.Enabled
		local.Model = server.Model
		local.Host = server.Host
		if server.Port > 0 {
			local.Port = server.Port
		}
		a.cfg.FiscalPrinter = local
	}
	if err := a.cfg.Save(); err != nil {
		log.Printf("could not persist server bridge configuration: %v", err)
	}
}

func (a *Agent) processJob(job PrintJob) {
	log.Printf("job %s received (order=%s area=%s)", job.ID, job.OrderID, job.Area)
	if a.runtime != nil {
		a.runtime.Status.RecordClaimed()
	}
	started := time.Now()

	target, ok := a.cfg.targetFor(job.Area)
	if !ok {
		err := fmt.Errorf("no printer mapping configured for area %q", job.Area)
		log.Printf("job %s failed to print: %v", job.ID, err)
		_ = a.api.Fail(a.cfg.BridgeID, job.ID, err.Error())
		a.recordJob(job, "failed", err.Error(), started)
		return
	}

	// Only QZ-backed targets depend on QZ Tray being up. When it is temporarily
	// unavailable the job is skipped WITHOUT marking it failed: it stays
	// "dispatched" server-side and the reclaim logic re-claims it after a few
	// minutes, so a transient QZ hiccup never loses an order's ticket.
	if !target.isNetwork() {
		if err := a.ensureQZ(); err != nil {
			log.Printf("job %s deferred (QZ Tray unavailable): %v", job.ID, err)
			a.recordJob(job, "deferred", err.Error(), started)
			return
		}
	}

	if err := a.dispatchPrint(target, job.Payload); err != nil {
		log.Printf("job %s failed to print: %v", job.ID, err)
		_ = a.api.Fail(a.cfg.BridgeID, job.ID, err.Error())
		a.recordJob(job, "failed", err.Error(), started)
		return
	}

	if err := a.api.Complete(a.cfg.BridgeID, job.ID); err != nil {
		log.Printf("job %s printed but complete report failed: %v", job.ID, err)
		a.recordJob(job, "printed", err.Error(), started)
		return
	}
	a.recordJob(job, "printed", "", started)
	log.Printf("job %s completed", job.ID)
}

// isNetwork reports whether the target prints over raw TCP instead of QZ Tray.
func (t PrinterTarget) isNetwork() bool {
	return t.IP != "" && (t.Type == "" || t.Type == "tcp")
}

// dispatchPrint sends the ESC/POS payload to the resolved target, ensuring QZ
// Tray is connected for QZ-backed targets.
func (a *Agent) dispatchPrint(target PrinterTarget, payloadB64 string) error {
	if target.isNetwork() {
		return PrintRawTCP(target.IP, target.Port, payloadB64, a.printTimeout)
	}
	if err := a.ensureQZ(); err != nil {
		return err
	}
	return a.qz.Print(target.Name, payloadB64, a.printTimeout)
}
