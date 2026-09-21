//go:build !windows

package main

// Non-Windows installations use the existing systemd/launchd integration.
func ensureStartup() error { return nil }
func removeStartup() error { return nil }
