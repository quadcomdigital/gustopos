//go:build windows

package main

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"unsafe"
)

const (
	startupTaskName    = "GustoPOS Print Agent"
	errorAlreadyExists = syscall.Errno(183) // ERROR_ALREADY_EXISTS
	// Fallback autostart location that does not require elevation.
	runKeyPath   = `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`
	runValueName = "GustoPOS Print Agent"
)

var (
	kernel32         = syscall.NewLazyDLL("kernel32.dll")
	procCreateMutexW = kernel32.NewProc("CreateMutexW")
	procReleaseMutex = kernel32.NewProc("ReleaseMutex")
	procCloseHandle  = kernel32.NewProc("CloseHandle")
)

// ensureStartup registers the current executable to start at logon.
// QZ Tray runs in the interactive user's session, so this intentionally uses
// the current user rather than a Windows service/SYSTEM task.
//
// It first tries a scheduled ONLOGON task; when that is denied (for example a
// pre-existing task owned by another account, or a locked-down policy) it
// falls back to the HKCU Run key, which needs no elevation. The named-mutex
// single-instance guard keeps the two from ever running twice.
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
	// install path such as "C:\Program Files\GustoPOS" remains valid. The
	// -background flag suppresses modal dialogs so an unattended logon run can
	// never hang on an error box.
	// A stale task left behind by an earlier install (possibly owned by
	// another account) makes /Create fail with "Accesso negato" and — worse —
	// can keep launching the OLD binary at logon, racing this one for the
	// single-instance mutex. Remove it first (best effort: a foreign-owned
	// task also refuses deletion, and the Run-key fallback below still works).
	if output, delErr := exec.Command("schtasks", "/Delete", "/TN", startupTaskName, "/F").CombinedOutput(); delErr == nil {
		log.Printf("removed pre-existing scheduled task %q before re-registering", startupTaskName)
	} else {
		log.Printf("scheduled task %q not removed (%v: %s) — continuing", startupTaskName, delErr, strings.TrimSpace(string(output)))
	}
	runCommand := fmt.Sprintf(`"%s" -background`, executable)
	taskCmd := exec.Command("schtasks", "/Create",
		"/TN", startupTaskName,
		"/SC", "ONLOGON",
		"/TR", runCommand,
		"/RL", "LIMITED",
		"/F",
	)
	if output, taskErr := taskCmd.CombinedOutput(); taskErr == nil {
		return nil
	} else {
		log.Printf("scheduled task registration failed (%v: %s); trying HKCU Run key", taskErr, strings.TrimSpace(string(output)))
	}

	if output, regErr := exec.Command("reg", "add", runKeyPath,
		"/v", runValueName, "/t", "REG_SZ", "/d", runCommand, "/f",
	).CombinedOutput(); regErr != nil {
		return fmt.Errorf("register autostart: HKCU Run key failed: %w (%s)", regErr, string(output))
	}
	log.Printf("automatic startup registered via HKCU Run key")
	return nil
}

func removeStartup() error {
	taskErr := exec.Command("schtasks", "/Delete", "/TN", startupTaskName, "/F").Run()
	regErr := exec.Command("reg", "delete", runKeyPath, "/v", runValueName, "/f").Run()
	if taskErr != nil && regErr != nil {
		return fmt.Errorf("remove autostart: task: %v; HKCU Run key: %v", taskErr, regErr)
	}
	return nil
}

// acquireSingleInstance uses a named Windows mutex. The second process exits
// before reading or writing config.json, preventing duplicate bridge rows and
// competing claims when the user manually starts the exe while the task runs.
// The mutex is owned by the first process and released on exit.
func acquireSingleInstance() (release func(), alreadyRunning bool, err error) {
	name, err := syscall.UTF16PtrFromString(`Global\GustoPOSPrintAgent`)
	if err != nil {
		return nil, false, err
	}
	// bInitialOwner = 1: the creator owns the mutex and must release it.
	handle, _, callErr := procCreateMutexW.Call(0, 1, uintptr(unsafe.Pointer(name)))
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
