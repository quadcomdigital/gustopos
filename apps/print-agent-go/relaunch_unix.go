//go:build !windows

package main

import (
	"fmt"
	"os"
	"os/exec"
	"syscall"
)

// relaunchSelf starts a detached replacement after this process exits. Under
// systemd the unit is restarted by the service manager, so nothing to spawn.
func relaunchSelf() error {
	if os.Getenv("INVOCATION_ID") != "" {
		return nil
	}
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	cmd := exec.Command("/bin/sh", "-c", fmt.Sprintf("sleep 2; exec %q", exe))
	cmd.SysProcAttr = &syscall.SysProcAttr{Setsid: true}
	return cmd.Start()
}
