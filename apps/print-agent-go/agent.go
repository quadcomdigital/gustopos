package main

import (
	"context"
	"fmt"
	"log"
	"sort"
	"strings"
	"time"
)

// Agent runs the print-bridge lifecycle on the POS machine. It talks
// directly to the API (no browser, no JWT): the 6-digit pairing code is the
// credential, and the server ties every poll to the tenant that claimed us.
type Agent struct {
	cfg *Config
	api *API
	qz  *QZClient

	heartbeatEvery     time.Duration
	claimEvery         time.Duration
	fiscalClaimEvery   time.Duration
	claimBatch         int
	printTimeout       time.Duration
	discoveredPrinters []string
}

func NewAgent(cfg *Config) (*Agent, error) {
	api := NewAPI(cfg.APIBase, "", cfg.Code, cfg.InstanceID)
	// Persist the canonical origin on the next config save so legacy
	// installations no longer reintroduce /api and the certificate 404.
	cfg.APIBase = api.Base
	if err := cfg.Save(); err != nil {
		log.Printf("could not persist canonical API origin: %v", err)
	}
	cachedPrinters := append([]string(nil), cfg.DiscoveredPrinters...)
	return &Agent{
		cfg:                cfg,
		api:                api,
		heartbeatEvery:     30 * time.Second,
		claimEvery:         3 * time.Second,
		fiscalClaimEvery:   5 * time.Second,
		claimBatch:         10,
		printTimeout:       30 * time.Second,
		discoveredPrinters: cachedPrinters,
	}, nil
}

// ensureQZ connects to QZ Tray, fetching the signing certificate on first use.
// If the connection was dropped (QZ Tray restarted, PC woke up, ...) it
// recreates the client so printing keeps working without a process restart.
func (a *Agent) ensureQZ() error {
	if a.qz != nil && a.qz.Connected() {
		return nil
	}
	// Discard the stale client (its readLoop already closed the socket).
	if a.qz != nil {
		a.qz.Close()
		a.qz = nil
	}
	cert, err := a.api.FetchCertificate()
	if err != nil {
		return fmt.Errorf("fetch signing certificate: %w", err)
	}
	url := fmt.Sprintf("ws://localhost:%d", a.cfg.QZPort)
	if a.cfg.QZSecure {
		url = fmt.Sprintf("wss://localhost:%d", a.cfg.QZPort)
	}
	qz := NewQZClient(url, cert, a.api.SignQzMessage)
	if err := qz.Connect(); err != nil {
		return err
	}
	a.qz = qz
	log.Printf("connected to QZ Tray at %s", url)
	return nil
}

// Run blocks until ctx is cancelled, the agent stops, or the credential is
// revoked. It closes QZ on every exit so tray-triggered shutdown is clean.
// Returns errDetachedSentinel when the API rejects us with 401 (the admin
// detached the bridge in Settings) so the caller can re-trigger pairing.
var errDetachedSentinel = fmt.Errorf("bridge detached")

func (a *Agent) Run(ctx context.Context) error {
	defer func() {
		if a.qz != nil {
			a.qz.Close()
			a.qz = nil
		}
	}()
	// QZ discovery is best-effort: the API heartbeat must still run when QZ
	// Tray is starting or temporarily unavailable.
	_ = a.ensureQZ()
	a.discoverPrinters()

	// First heartbeat also performs the bind if this is a fresh pairing.
	if response, err := a.api.Heartbeat(a.cfg, a.discoveredPrinters); err != nil {
		if IsDetached(err) {
			return errDetachedSentinel
		}
		log.Printf("initial heartbeat failed (will retry): %v", err)
	} else {
		a.applyHeartbeatConfig(response)
	}

	hb := time.NewTicker(a.heartbeatEvery)
	defer hb.Stop()
	cl := time.NewTicker(a.claimEvery)
	defer cl.Stop()
	fc := time.NewTicker(a.fiscalClaimEvery)
	defer fc.Stop()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-hb.C:
			a.discoverPrinters()
			if response, err := a.api.Heartbeat(a.cfg, a.discoveredPrinters); err != nil {
				if IsDetached(err) {
					return errDetachedSentinel
				}
				log.Printf("heartbeat failed: %v", err)
			} else {
				a.applyHeartbeatConfig(response)
			}
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
	if err := a.cfg.Save(); err != nil {
		log.Printf("could not persist discovered printers: %v", err)
	}
	log.Printf("discovered %d local printer(s) via QZ Tray", len(a.discoveredPrinters))
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
	for _, job := range jobs {
		a.processJob(job)
	}
	return nil
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
	}
	if response.Bridge.ClaimedAreas != nil {
		a.cfg.Areas = append([]string(nil), response.Bridge.ClaimedAreas...)
	}
	if response.Bridge.Mappings != nil {
		printers := make(map[string]string, len(response.Bridge.Mappings))
		for _, mapping := range response.Bridge.Mappings {
			if mapping.Area != "" && mapping.Name != "" {
				printers[mapping.Area] = mapping.Name
			}
		}
		a.cfg.PrinterNames = printers
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

	// QZ Tray temporarily unavailable: skip the job WITHOUT marking it failed.
	// The job stays "dispatched" server-side and the reclaim logic re-claims
	// it after a few minutes, so a transient QZ Tray hiccup never loses an
	// order's ticket.
	if err := a.ensureQZ(); err != nil {
		log.Printf("job %s deferred (QZ Tray unavailable): %v", job.ID, err)
		return
	}

	printer := a.cfg.PrinterNames[job.Area]
	if printer == "" {
		printer = a.cfg.PrinterNames["default"]
	}
	if printer == "" {
		err := fmt.Errorf("no printer mapping configured for area %q", job.Area)
		log.Printf("job %s failed to print: %v", job.ID, err)
		_ = a.api.Fail(a.cfg.BridgeID, job.ID, err.Error())
		return
	}

	if err := a.qz.Print(printer, job.Payload, a.printTimeout); err != nil {
		log.Printf("job %s failed to print: %v", job.ID, err)
		_ = a.api.Fail(a.cfg.BridgeID, job.ID, err.Error())
		return
	}

	if err := a.api.Complete(a.cfg.BridgeID, job.ID); err != nil {
		log.Printf("job %s printed but complete report failed: %v", job.ID, err)
		return
	}
	log.Printf("job %s completed", job.ID)
}
