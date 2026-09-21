//go:build windows

package main

import (
	"fmt"
	"os"
	"os/exec"
	"syscall"
)

// relaunchSelf starts a detached replacement after this process exits, so the
// single-instance mutex is free when it starts.
func relaunchSelf() error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	command := fmt.Sprintf(`ping -n 4 127.0.0.1 >nul & start "" "%s"`, exe)
	cmd := exec.Command("cmd", "/c", command)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x00000008} // DETACHED_PROCESS
	return cmd.Start()
}
