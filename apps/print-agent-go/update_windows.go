//go:build windows

package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
)

// installAndRestart swaps in the freshly verified binary. A running Windows
// executable cannot be overwritten, so a detached cmd waits for this process
// to exit, moves the new binary into place (checking the result) and starts it
// again. main releases the single-instance mutex before calling this.
func installAndRestart(updatedPath string) error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	dir := filepath.Dir(exe)
	scriptPath := filepath.Join(dir, ".gustopos-update.cmd")
	logPath := filepath.Join(dir, "update.log")
	script := fmt.Sprintf(
		"@echo off\r\n"+
			"ping -n 3 127.0.0.1 >nul\r\n"+
			"move /y \"%s\" \"%s\" >nul\r\n"+
			"if errorlevel 1 (echo %%date%% %%time%% move failed >> \"%s\") else (echo %%date%% %%time%% applied >> \"%s\")\r\n"+
			"start \"\" \"%s\"\r\n",
		updatedPath, exe, logPath, logPath, exe,
	)
	if err := os.WriteFile(scriptPath, []byte(script), 0o600); err != nil {
		return err
	}
	cmd := exec.Command("cmd", "/c", scriptPath)
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
	_ = os.Remove(filepath.Join(dir, ".gustopos-update.cmd"))
	_ = os.Remove(exe + ".old")
}
