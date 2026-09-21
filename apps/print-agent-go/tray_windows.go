//go:build windows

package main

import (
	"log"
	"runtime"
	"sync"
	"syscall"
	"time"
	"unsafe"
)

const (
	trayCallbackMessage = uint32(0x8001) // WM_APP + 1
	wmDestroy           = uint32(0x0002)
	wmCommand           = uint32(0x0111)
	wmContextMenu       = uint32(0x007B)
	wmLButtonUp         = uint32(0x0202)
	wmRButtonUp         = uint32(0x0205)
	wmTimer             = uint32(0x0113)
	wmNull              = uint32(0x0000)

	nimAdd     = uint32(0x00000000)
	nimModify  = uint32(0x00000001)
	nimDelete  = uint32(0x00000002)
	nifMessage = uint32(0x00000001)
	nifIcon    = uint32(0x00000002)
	nifTip     = uint32(0x00000004)

	idiApplication = 32512
	colorWindow    = 5
	csHRedraw      = 0x0002
	csVRedraw      = 0x0001
	wsExToolWindow = 0x00000080
	wsExNoActivate = 0x08000000

	tpmRightButton = 0x0002
	tpmNoNotify    = 0x0080
	mfString       = 0x0000
	mfSeparator    = 0x0800
	mfGrayed       = 0x0001

	trayMenuPairing   = 1001
	trayMenuStatus    = 1002
	trayMenuUninstall = 1003
	trayMenuExit      = 1004
	trayMenuDashboard = 1005
	trayTimerID       = 1
)

type trayPoint struct {
	x int32
	y int32
}

type trayWndClass struct {
	style       uint32
	windowProc  uintptr
	classExtra  int32
	windowExtra int32
	instance    syscall.Handle
	icon        syscall.Handle
	cursor      syscall.Handle
	background  syscall.Handle
	menuName    *uint16
	className   *uint16
}

type notifyIconData struct {
	cbSize           uint32
	hWnd             syscall.Handle
	uID              uint32
	uFlags           uint32
	uCallbackMessage uint32
	hIcon            syscall.Handle
	szTip            [128]uint16
	dwState          uint32
	dwStateMask      uint32
	szInfo           [256]uint16
	union            [4]byte
	szInfoTitle      [64]uint16
	dwInfoFlags      uint32
	guidItem         [16]byte
	hBalloonIcon     syscall.Handle
}

var (
	trayUser32           = syscall.NewLazyDLL("user32.dll")
	trayShell32          = syscall.NewLazyDLL("shell32.dll")
	trayKernel32         = syscall.NewLazyDLL("kernel32.dll")
	trayRegisterClass    = trayUser32.NewProc("RegisterClassW")
	trayCreateWindow     = trayUser32.NewProc("CreateWindowExW")
	trayDefWindowProc    = trayUser32.NewProc("DefWindowProcW")
	trayDestroyWindow    = trayUser32.NewProc("DestroyWindow")
	trayPostMessage      = trayUser32.NewProc("PostMessageW")
	traySetTimer         = trayUser32.NewProc("SetTimer")
	trayKillTimer        = trayUser32.NewProc("KillTimer")
	trayGetMessage       = trayUser32.NewProc("GetMessageW")
	trayTranslateMessage = trayUser32.NewProc("TranslateMessage")
	trayDispatchMessage  = trayUser32.NewProc("DispatchMessageW")
	trayPostQuitMessage  = trayUser32.NewProc("PostQuitMessage")
	trayLoadIcon         = trayUser32.NewProc("LoadIconW")
	trayLoadCursor       = trayUser32.NewProc("LoadCursorW")
	trayTrackPopupMenu   = trayUser32.NewProc("TrackPopupMenu")
	trayCreatePopupMenu  = trayUser32.NewProc("CreatePopupMenu")
	trayAppendMenu       = trayUser32.NewProc("AppendMenuW")
	trayDestroyMenu      = trayUser32.NewProc("DestroyMenu")
	traySetForeground    = trayUser32.NewProc("SetForegroundWindow")
	trayGetCursorPos     = trayUser32.NewProc("GetCursorPos")
	trayShellNotifyIcon  = trayShell32.NewProc("Shell_NotifyIconW")
	trayGetModuleHandle  = trayKernel32.NewProc("GetModuleHandleW")
)

type trayMessage struct {
	hWnd   syscall.Handle
	msg    uint32
	wParam uintptr
	lParam uintptr
	time   uint32
	point  trayPoint
}

type windowsTray struct {
	hWnd          syscall.Handle
	hIcon         syscall.Handle
	status        func() string
	openPairing   func()
	openDashboard func()
	requestExit   func()
	bridgeID      string
	mu            sync.RWMutex
	closed        chan struct{}
	closeOnce     sync.Once
}

// StartTray starts the notification icon on a locked OS thread so the
// agent's polling and printing goroutines are never blocked.
// The returned function removes the icon and stops the message pump.
func StartTray(bridgeID string, status func() string, openPairing func(), openDashboard func(), requestExit func()) (func(), func(string)) {
	tray := &windowsTray{
		status:        status,
		openPairing:   openPairing,
		openDashboard: openDashboard,
		requestExit:   requestExit,
		bridgeID:      bridgeID,
		closed:        make(chan struct{}),
	}
	ready := make(chan struct{})
	go tray.run(bridgeID, ready)
	<-ready
	return tray.close, func(id string) { tray.updateBridgeID(id) }
}

func (t *windowsTray) run(bridgeID string, ready chan<- struct{}) {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()

	instance, _, _ := trayGetModuleHandle.Call(0)
	className, _ := syscall.UTF16PtrFromString("GustoPOSPrintAgentTrayWindow")
	icon, _, _ := trayLoadIcon.Call(0, uintptr(idiApplication))
	t.hIcon = syscall.Handle(icon)
	proc := syscall.NewCallback(t.windowProc)
	wc := trayWndClass{
		style:      csHRedraw | csVRedraw,
		windowProc: proc,
		instance:   syscall.Handle(instance),
		icon:       t.hIcon,
		cursor:     syscall.Handle(mustLoadCursor()),
		background: syscall.Handle(colorWindow + 1),
		className:  className,
	}
	trayRegisterClass.Call(uintptr(unsafe.Pointer(&wc)))
	hWnd, _, err := trayCreateWindow.Call(
		wsExToolWindow|wsExNoActivate,
		uintptr(unsafe.Pointer(className)),
		uintptr(unsafe.Pointer(className)),
		uintptr(wmNull),
		0, 0, 0, 0,
		0, 0, instance, 0,
	)
	if hWnd == 0 {
		log.Printf("could not create tray window: %v", err)
		close(ready)
		close(t.closed)
		return
	}
	t.hWnd = syscall.Handle(hWnd)
	t.notify(nimAdd, "GustoPOS Print Agent — "+bridgeID)
	traySetTimer.Call(uintptr(t.hWnd), trayTimerID, 5000, 0)
	close(ready)

	var msg trayMessage
	for {
		result, _, _ := trayGetMessage.Call(uintptr(unsafe.Pointer(&msg)), 0, 0, 0)
		if int32(result) <= 0 {
			break
		}
		trayTranslateMessage.Call(uintptr(unsafe.Pointer(&msg)))
		trayDispatchMessage.Call(uintptr(unsafe.Pointer(&msg)))
	}
	trayKillTimer.Call(uintptr(t.hWnd), trayTimerID)
	t.notify(nimDelete, "")
	trayDestroyWindow.Call(uintptr(t.hWnd))
	close(t.closed)
}

func (t *windowsTray) close() {
	if t == nil || t.hWnd == 0 {
		return
	}
	t.closeOnce.Do(func() {
		trayPostMessage.Call(uintptr(t.hWnd), uintptr(wmDestroy), 0, 0)
		// Never block shutdown forever if the tray message loop is stuck.
		select {
		case <-t.closed:
		case <-time.After(3 * time.Second):
			log.Printf("tray did not stop within timeout")
		}
	})
}

func (t *windowsTray) updateBridgeID(bridgeID string) {
	if t == nil || t.hWnd == 0 {
		return
	}
	t.mu.Lock()
	t.bridgeID = bridgeID
	t.mu.Unlock()
	trayPostMessage.Call(uintptr(t.hWnd), uintptr(wmTimer), 0, 0)
}

func (t *windowsTray) windowProc(hwnd uintptr, msg uint32, wParam, lParam uintptr) uintptr {
	switch msg {
	case trayCallbackMessage:
		switch uint32(lParam) {
		case wmRButtonUp, wmContextMenu:
			t.showMenu()
		case wmLButtonUp:
			if t.openPairing != nil {
				t.openPairing()
			}
		}
	case wmCommand:
		switch uint32(wParam) & 0xffff {
		case trayMenuPairing:
			if t.openPairing != nil {
				t.openPairing()
			}
		case trayMenuDashboard:
			if t.openDashboard != nil {
				t.openDashboard()
			}
		case trayMenuUninstall:
			if err := removeStartup(); err != nil {
				log.Printf("could not remove automatic startup: %v", err)
			} else {
				log.Println("automatic startup removed")
			}
		case trayMenuExit:
			if t.requestExit != nil {
				t.requestExit()
			}
		}
	case wmTimer:
		status := "Disconnesso"
		if t.status != nil {
			status = t.status()
		}
		t.mu.RLock()
		bridgeID := t.bridgeID
		t.mu.RUnlock()
		if wParam == trayTimerID || wParam == 0 {
			t.notify(nimModify, "GustoPOS Print Agent — "+bridgeID+" — "+status)
		}
	case wmDestroy:
		trayPostQuitMessage.Call(0)
	}
	result, _, _ := trayDefWindowProc.Call(hwnd, uintptr(msg), wParam, lParam)
	return result
}

func (t *windowsTray) notify(operation uint32, tooltip string) {
	if t.hWnd == 0 {
		return
	}
	data := notifyIconData{
		cbSize:           uint32(unsafe.Sizeof(notifyIconData{})),
		hWnd:             t.hWnd,
		uID:              1,
		uFlags:           nifMessage | nifIcon | nifTip,
		uCallbackMessage: trayCallbackMessage,
		hIcon:            t.hIcon,
	}
	if tooltip != "" {
		copy(data.szTip[:], utf16Fixed(tooltip, len(data.szTip)-1))
	}
	trayShellNotifyIcon.Call(uintptr(operation), uintptr(unsafe.Pointer(&data)))
}

func (t *windowsTray) showMenu() {
	if t.hWnd == 0 {
		return
	}
	menu, _, _ := trayCreatePopupMenu.Call()
	if menu == 0 {
		return
	}
	appendItem := func(flags uintptr, id uintptr, text string) {
		label, _ := syscall.UTF16PtrFromString(text)
		trayAppendMenu.Call(menu, flags, id, uintptr(unsafe.Pointer(label)))
	}
	appendItem(mfString, trayMenuPairing, "Apri pairing / Inserisci codice")
	appendItem(mfString, trayMenuDashboard, "Apri pannello diagnostica")
	status := "Stato: Disconnesso"
	if t.status != nil {
		status = "Stato: " + t.status()
	}
	appendItem(mfString|mfGrayed, trayMenuStatus, status)
	appendItem(mfString, trayMenuUninstall, "Disinstalla autostart")
	appendItem(mfSeparator, 0, "")
	appendItem(mfString, trayMenuExit, "Esci")
	var point trayPoint
	trayGetCursorPos.Call(uintptr(unsafe.Pointer(&point)))
	traySetForeground.Call(uintptr(t.hWnd))
	trayTrackPopupMenu.Call(menu, tpmRightButton|tpmNoNotify, uintptr(point.x), uintptr(point.y), 0, uintptr(t.hWnd), 0)
	// Required by TrackPopupMenu to dismiss the menu reliably on older shells.
	trayPostMessage.Call(uintptr(t.hWnd), uintptr(wmNull), 0, 0)
	trayDestroyMenu.Call(menu)
}

func utf16Fixed(s string, max int) []uint16 {
	encoded, _ := syscall.UTF16FromString(s)
	if len(encoded) > max {
		encoded = encoded[:max]
	}
	return encoded
}

func mustLoadCursor() uintptr {
	cursor, _, _ := trayLoadCursor.Call(0, uintptr(32512))
	return cursor
}
