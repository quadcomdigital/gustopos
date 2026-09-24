package main

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"time"
)

// Relaunch support. Used by the heartbeat watchdog and the dashboard "Riavvia"
// action to replace a stalled or unresponsive process: a fresh instance is
// started detached and the current process exits, releasing the single-instance
// lock. A guard prevents a crash-loop from spawning instances forever.

const (
	maxRelaunchPerWindow = 5
	relaunchWindow       = 10 * time.Minute
)

type relaunchAttempt struct {
	Count int       `json:"count"`
	At    time.Time `json:"at"`
}

func relaunchAttemptPath() string {
	return filepath.Join(filepath.Dir(configPath()), ".relaunch-attempt.json")
}

func shouldBlockRelaunch() bool {
	raw, err := os.ReadFile(relaunchAttemptPath())
	if err != nil {
		return false
	}
	var attempt relaunchAttempt
	if json.Unmarshal(raw, &attempt) != nil {
		return false
	}
	return attempt.Count >= maxRelaunchPerWindow && time.Since(attempt.At) < relaunchWindow
}

func recordRelaunch() {
	now := time.Now().UTC()
	attempt := relaunchAttempt{Count: 1, At: now}
	if raw, err := os.ReadFile(relaunchAttemptPath()); err == nil {
		var previous relaunchAttempt
		if json.Unmarshal(raw, &previous) == nil && time.Since(previous.At) < relaunchWindow {
			attempt.Count = previous.Count + 1
			attempt.At = previous.At
		}
	}
	if raw, err := json.Marshal(attempt); err == nil {
		_ = os.WriteFile(relaunchAttemptPath(), raw, 0o600)
	}
}

// resetRelaunchGuard clears the crash-loop counter. The guard exists only to
// stop *automatic* crash loops; a user-requested restart must always work.
func resetRelaunchGuard() {
	_ = os.Remove(relaunchAttemptPath())
}

// relaunchAndExit spawns a replacement process and terminates this one. If the
// restart guard trips (too many recent restarts), it leaves this process alive
// and lets the watchdog retry once the window expires, instead of exiting and
// leaving the POS without an agent until the next logon.
func relaunchAndExit() {
	if shouldBlockRelaunch() {
		log.Printf("watchdog: too many restarts in the last %s; will retry after the window", relaunchWindow)
		return
	}
	recordRelaunch()
	writeExitRecord("relaunch")
	if err := relaunchSelf(); err != nil {
		log.Printf("watchdog: could not relaunch: %v", err)
	}
	os.Exit(0)
}
