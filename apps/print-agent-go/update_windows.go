//go:build windows

package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
)

// replaceAndRestart installs the freshly verified binary. A running Windows
// executable cannot be overwritten, so a detached cmd waits for this process to
// exit, moves the new binary into place and starts it again. The named-mutex
// single-instance check then succeeds for the new process.
func replaceAndRestart(updatedPath string) error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	command := fmt.Sprintf(
		`ping -n 3 127.0.0.1 >nul & move /y "%s" "%s" >nul & start "" "%s"`,
		updatedPath, exe, exe,
	)
	cmd := exec.Command("cmd", "/c", command)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x00000008} // DETACHED_PROCESS
	return cmd.Start()
}

// cleanupStaleUpdate removes leftovers from a previous self-update.
func cleanupStaleUpdate() {
	exe, err := os.Executable()
	if err != nil {
		return
	}
	dir := filepath.Dir(exe)
	_ = os.Remove(filepath.Join(dir, ".gustopos-print-agent.update"))
	_ = os.Remove(filepath.Join(dir, ".gustopos-print-agent.update.part"))
	_ = os.Remove(exe + ".old")
}
