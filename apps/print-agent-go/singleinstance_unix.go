//go:build linux || darwin

package main

import (
	"os"
	"path/filepath"
	"syscall"
)

// acquireSingleInstance uses an exclusive flock on a lock file so a second
// launch never runs a duplicate agent. The lock is released when the process
// exits (or the returned function is called).
func acquireSingleInstance() (release func(), alreadyRunning bool, err error) {
	paths := []string{
		filepath.Join(filepath.Dir(configPath()), "agent.lock"),
		filepath.Join(os.TempDir(), "gustopos-print-agent.lock"),
	}
	var file *os.File
	for _, path := range paths {
		file, err = os.OpenFile(path, os.O_CREATE|os.O_RDWR, 0o600)
		if err == nil {
			break
		}
	}
	if file == nil {
		return func() {}, false, err
	}
	if lockErr := syscall.Flock(int(file.Fd()), syscall.LOCK_EX|syscall.LOCK_NB); lockErr != nil {
		_ = file.Close()
		if lockErr == syscall.EWOULDBLOCK || lockErr == syscall.EAGAIN {
			return func() {}, true, nil
		}
		return func() {}, false, lockErr
	}
	return func() {
		_ = syscall.Flock(int(file.Fd()), syscall.LOCK_UN)
		_ = file.Close()
	}, false, nil
}
