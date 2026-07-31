//go:build windows

package main

import (
	"syscall"
	"unsafe"
)

// winMessageBox shows a native Windows dialog with the given title and message.
// Used on fatal startup errors (missing config/API URL) because a console app
// launched by double-click closes instantly — the log line would be invisible.
func winMessageBox(title, message string) {
	user32 := syscall.NewLazyDLL("user32.dll")
	msgbox := user32.NewProc("MessageBoxW")
	titlePtr, _ := syscall.UTF16PtrFromString(title)
	msgPtr, _ := syscall.UTF16PtrFromString(message)
	// hWnd = 0 (no parent), MB_OK = 0, MB_ICONERROR = 0x10.
	_, _, _ = msgbox.Call(
		0,
		uintptr(unsafe.Pointer(msgPtr)),
		uintptr(unsafe.Pointer(titlePtr)),
		0x10,
	)
}
