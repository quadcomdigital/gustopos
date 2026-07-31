//go:build !windows

package main

// winMessageBox is a no-op outside Windows (the real dialog lives in
// winmsg.go, which is windows-only). fatalExit only calls it on Windows.
func winMessageBox(title, message string) {}
