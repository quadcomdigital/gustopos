package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"runtime/debug"
	"time"
)

// ─── Lifecycle helpers: panic recovery, exit reason, dashboard hand-off ───

// recoverPanic is deferred in goroutines so a single bug cannot take the whole
// process down. The stack is written to the log file for post-mortem analysis.
func recoverPanic(component string) {
	if r := recover(); r != nil {
		log.Printf("panic in %s: %v\n%s", component, r, debug.Stack())
	}
}

// exitRecord explains why the previous run stopped, so a crash/hang is visible
// on the next start (the console-less Windows build has no other trace).
type exitRecord struct {
	Version string `json:"version"`
	Reason  string `json:"reason"`
	At      string `json:"at"`
}

func exitRecordPath() string {
	return filepath.Join(filepath.Dir(configPath()), ".last-exit.json")
}

func writeExitRecord(reason string) {
	record := exitRecord{
		Version: version,
		Reason:  reason,
		At:      time.Now().UTC().Format(time.RFC3339),
	}
	if raw, err := json.Marshal(record); err == nil {
		_ = os.WriteFile(exitRecordPath(), raw, 0o600)
	}
}

func logPreviousExit() {
	raw, err := os.ReadFile(exitRecordPath())
	if err != nil {
		return
	}
	var record exitRecord
	if json.Unmarshal(raw, &record) != nil {
		return
	}
	log.Printf("previous run exited: reason=%s version=%s at=%s", record.Reason, record.Version, record.At)
}

// openRunningDashboard opens the loopback dashboard of the instance that is
// already running, so a second launch is useful instead of a silent no-op.
func openRunningDashboard() {
	port := dashboardDefaultPort
	if cfg, err := LoadConfig(); err == nil && cfg != nil && cfg.DashboardPort > 0 {
		port = cfg.DashboardPort
	}
	openBrowser(fmt.Sprintf("http://127.0.0.1:%d", port))
}
