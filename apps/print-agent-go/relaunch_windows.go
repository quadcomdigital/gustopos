//go:build windows

package main

import (
	"os"
	"os/exec"
	"syscall"
)

// relaunchSelf starts a detached replacement of this same binary with a short
// startup delay so the old process exits and releases the single-instance
// mutex first. No cmd/console: the replacement inherits the original flags.
func relaunchSelf() error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	args := append([]string{}, os.Args[1:]...)
	args = append(args, "-startup-delay=2")
	cmd := exec.Command(exe, args...)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000} // CREATE_NO_WINDOW
	return cmd.Start()
}
