//go:build !windows

package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
)

// launchUpdater installs the staged binary. On Unix the running executable can
// be replaced atomically by renaming over it. Under systemd the unit restarts
// automatically after we exit; otherwise the new binary is started with a short
// -startup-delay so the single-instance lock is free.
func launchUpdater(updatedPath string) error {
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
		// systemd Restart=always will relaunch the unit after we exit.
		return nil
	}
	args := append([]string{}, os.Args[1:]...)
	args = append(args, "-startup-delay=2")
	cmd := exec.Command(exe, args...)
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
