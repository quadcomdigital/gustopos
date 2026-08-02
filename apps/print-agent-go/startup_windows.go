//go:build windows

package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"unsafe"
)

const (
	startupTaskName    = "GustoPOS Print Agent"
	errorAlreadyExists = syscall.Errno(183) // ERROR_ALREADY_EXISTS
)

var (
	kernel32         = syscall.NewLazyDLL("kernel32.dll")
	procCreateMutexW = kernel32.NewProc("CreateMutexW")
	procReleaseMutex = kernel32.NewProc("ReleaseMutex")
	procCloseHandle  = kernel32.NewProc("CloseHandle")
)

// ensureStartup registers the current executable as a user-session logon task.
// QZ Tray runs in the interactive user's session, so this intentionally uses
// the current user rather than a Windows service/SYSTEM task.
func ensureStartup() error {
	executable, err := os.Executable()
	if err != nil {
		return fmt.Errorf("resolve executable: %w", err)
	}
	executable, err = filepath.Abs(executable)
	if err != nil {
		return fmt.Errorf("resolve executable path: %w", err)
	}

	// /TR receives one command-line string. Keep the executable quoted so an
	// install path such as "C:\Program Files\GustoPOS" remains valid.
	runCommand := fmt.Sprintf(`"%s"`, executable)
	cmd := exec.Command("schtasks", "/Create",
		"/TN", startupTaskName,
		"/SC", "ONLOGON",
		"/TR", runCommand,
		"/RL", "LIMITED",
		"/F",
	)
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("register logon task: %w (%s)", err, string(output))
	}
	return nil
}

func removeStartup() error {
	output, err := exec.Command("schtasks", "/Delete", "/TN", startupTaskName, "/F").CombinedOutput()
	if err != nil {
		return fmt.Errorf("remove logon task: %w (%s)", err, string(output))
	}
	return nil
}

// acquireSingleInstance uses a named Windows mutex. The second process exits
// before reading or writing config.json, preventing duplicate bridge rows and
// competing claims when the user manually starts the exe while the task runs.
func acquireSingleInstance() (release func(), alreadyRunning bool, err error) {
	name, err := syscall.UTF16PtrFromString(`Global\GustoPOSPrintAgent`)
	if err != nil {
		return nil, false, err
	}
	handle, _, callErr := procCreateMutexW.Call(0, 0, uintptr(unsafe.Pointer(name)))
	if handle == 0 {
		return nil, false, callErr
	}
	if callErr == errorAlreadyExists {
		_, _, _ = procCloseHandle.Call(handle)
		return nil, true, nil
	}

	return func() {
		_, _, _ = procReleaseMutex.Call(handle)
		_, _, _ = procCloseHandle.Call(handle)
	}, false, nil
}
