//go:build !windows

package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
)

// installAndRestart installs the verified binary over the running one. On Unix
// a running executable can be replaced by renaming over it atomically. Under
// systemd we let the service manager restart the unit (avoids a duplicate
// instance); otherwise we detach a short-lived shell that re-execs the new
// binary once this process has exited.
func installAndRestart(updatedPath string) error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	if err := os.Chmod(updatedPath, 0o755); err != nil {
		return err
	}
	if err := os.Rename(updatedPath, exe); err != nil {
		return err
	}
	if os.Getenv("INVOCATION_ID") != "" {
		return nil
	}
	cmd := exec.Command("/bin/sh", "-c", fmt.Sprintf("sleep 1; exec %q", exe))
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
