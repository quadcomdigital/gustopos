//go:build windows

package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
)

// launchUpdater starts a detached updater that waits for THIS process to exit
// (so the single-instance mutex is free), replaces the binary only if the move
// succeeds, and then starts the new agent. It never touches the running
// installation until the PID is gone, so a failure cannot leave a half-updated
// or hung state.
func launchUpdater(updatedPath string) error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	dir := filepath.Dir(exe)
	scriptPath := filepath.Join(dir, ".gustopos-update.cmd")
	logPath := filepath.Join(dir, "update.log")

	script := strings.Join([]string{
		"@echo off",
		"setlocal",
		`set "PID=%~1"`,
		`set "NEW=%~2"`,
		`set "TARGET=%~3"`,
		`set "LOG=%~4"`,
		"set /a tries=0",
		":wait",
		`tasklist /FI "PID eq %PID%" /NH 2>NUL | find "%PID%" >NUL`,
		"if errorlevel 1 goto gone",
		"set /a tries+=1",
		"if %tries% GEQ 30 (",
		`  echo %date% %time% timeout waiting for PID %PID% >> "%LOG%"`,
		"  exit /b 1",
		")",
		"timeout /t 1 /nobreak >NUL",
		"goto wait",
		":gone",
		`move /y "%NEW%" "%TARGET%" >NUL`,
		"if errorlevel 1 (",
		`  echo %date% %time% move failed >> "%LOG%"`,
		"  exit /b 1",
		")",
		`echo %date% %time% applied >> "%LOG%"`,
		`start "" "%TARGET%"`,
		"",
	}, "\r\n")

	if err := os.WriteFile(scriptPath, []byte(script), 0o600); err != nil {
		return err
	}
	cmd := exec.Command("cmd", "/c", scriptPath, strconv.Itoa(os.Getpid()), updatedPath, exe, logPath)
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
