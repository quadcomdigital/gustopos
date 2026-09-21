//go:build !windows

package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
)

// launchUpdater installs the verified binary. Under systemd the unit is
// restarted by the service manager after we exit, so the binary is swapped
// immediately. Otherwise a detached shell waits for this process to exit (so
// the single-instance lock is free), then swaps and re-execs the new binary.
func launchUpdater(updatedPath string) error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	if err := os.Chmod(updatedPath, 0o755); err != nil {
		return err
	}
	if os.Getenv("INVOCATION_ID") != "" {
		// systemd Restart=always will relaunch the unit after we exit.
		return os.Rename(updatedPath, exe)
	}
	script := fmt.Sprintf(
		"i=0; while kill -0 %d 2>/dev/null; do i=$((i+1)); [ $i -ge 60 ] && break; sleep 1; done; mv %q %q; exec %q",
		os.Getpid(), updatedPath, exe, exe,
	)
	cmd := exec.Command("/bin/sh", "-c", script)
	cmd.SysProcAttr = &syscall.SysProcAttr{Setsid: true}
	return cmd.Start()
}

// cleanupStaleUpdate removes a partial download from a previous self-update.
func cleanupStaleUpdate() {
	exe, err := os.Executable()
	if err != nil {
		return
	}
	dir := filepath.Dir(exe)
	_ = os.Remove(filepath.Join(dir, ".gustopos-print-agent.update"))
	_ = os.Remove(filepath.Join(dir, ".gustopos-print-agent.update.part"))
}
