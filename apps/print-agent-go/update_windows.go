//go:build windows

package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
)

// launchUpdater installs an already-staged binary without any external shell.
//
// A running Windows executable cannot be overwritten, but it CAN be renamed, so
// we rename the current exe aside, move the new one into place and start it with
// a short -startup-delay so the old process has time to exit and release the
// single-instance mutex. No cmd/tasklist/find, no visible console.
func launchUpdater(updatedPath string) error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	old := exe + ".old"
	_ = os.Remove(old)

	if err := os.Rename(exe, old); err != nil {
		return fmt.Errorf("stage running binary aside: %w", err)
	}
	if err := os.Rename(updatedPath, exe); err != nil {
		_ = os.Rename(old, exe) // rollback so the old binary keeps working
		return fmt.Errorf("install new binary: %w", err)
	}
	return startDelayed(exe)
}

// startDelayed launches the freshly installed binary with a startup delay, so
// it acquires the single-instance lock only after this process has exited.
func startDelayed(exe string) error {
	args := append([]string{}, os.Args[1:]...)
	args = append(args, "-startup-delay=4")
	cmd := exec.Command(exe, args...)
	// CREATE_NO_WINDOW: never allocate a console for the replacement process.
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
	return cmd.Start()
}

// cleanupStaleUpdate removes leftovers from a previous self-update.
func cleanupStaleUpdate() {
	exe, err := os.Executable()
	if err != nil {
		return
	}
	dir := filepath.Dir(exe)
	_ = os.Remove(exe + ".old")
	_ = os.Remove(filepath.Join(dir, ".gustopos-print-agent.update"))
	_ = os.Remove(filepath.Join(dir, ".gustopos-print-agent.update.part"))
	_ = os.Remove(filepath.Join(dir, ".gustopos-update.cmd"))
}
