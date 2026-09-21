//go:build !windows

package main

// StartTray is a no-op on platforms without the Windows shell notification API.
func StartTray(_ string, _ func() string, _ func(), _ func(), _ func()) (func(), func(string)) {
	return func() {}, func(string) {}
}
