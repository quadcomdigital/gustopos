package main

import (
	"fmt"
	"log"
	"time"
)

// Agent runs the print-bridge lifecycle on the POS machine. It talks
// directly to the API (no browser, no JWT): the 6-digit pairing code is the
// credential, and the server ties every poll to the tenant that claimed us.
type Agent struct {
	cfg *Config
	api *API
	qz  *QZClient

	heartbeatEvery time.Duration
	claimEvery     time.Duration
	claimBatch     int
	printTimeout   time.Duration
}

func NewAgent(cfg *Config) (*Agent, error) {
	api := NewAPI(cfg.APIBase, "", cfg.Code, cfg.InstanceID)
	return &Agent{
		cfg:            cfg,
		api:            api,
		heartbeatEvery: 30 * time.Second,
		claimEvery:     3 * time.Second,
		claimBatch:     10,
		printTimeout:   30 * time.Second,
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

// Run blocks forever until the agent stops or the credential is revoked.
// Returns errDetachedSentinel when the API rejects us with 401 (the admin
// detached the bridge in Settings) so the caller can re-trigger pairing.
var errDetachedSentinel = fmt.Errorf("bridge detached")

func (a *Agent) Run() error {
	// First heartbeat also performs the bind if this is a fresh pairing.
	if _, err := a.api.Heartbeat(a.cfg); err != nil {
		if IsDetached(err) {
			return errDetachedSentinel
		}
		log.Printf("initial heartbeat failed (will retry): %v", err)
	}

	// QZ Tray may not be running yet — don't block the loop on it.
	_ = a.ensureQZ()

	hb := time.NewTicker(a.heartbeatEvery)
	defer hb.Stop()
	cl := time.NewTicker(a.claimEvery)
	defer cl.Stop()

	for {
		select {
		case <-hb.C:
			if _, err := a.api.Heartbeat(a.cfg); err != nil {
				if IsDetached(err) {
					return errDetachedSentinel
				}
				log.Printf("heartbeat failed: %v", err)
			}
		case <-cl.C:
			if err := a.claimOnce(); err != nil {
				if err == errDetachedSentinel {
					return err
				}
			}
		}
	}
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
		// Fall back to the bridge ID as the printer name; admins should set
		// printerNames[area] in the config for deterministic routing.
		printer = a.cfg.BridgeID
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
