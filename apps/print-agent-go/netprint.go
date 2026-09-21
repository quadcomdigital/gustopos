package main

import (
	"encoding/base64"
	"fmt"
	"net"
	"strconv"
	"strings"
	"time"
)

// PrintRawTCP streams a raw ESC/POS payload (base64) straight to a network
// printer over TCP (raw/JetDirect, default port 9100). It bypasses QZ Tray and
// the OS print queue entirely, so it works on a POS PC regardless of which
// drivers are installed. This is what lets a station be bound to a printer by
// IP instead of only by the name QZ Tray sees on that specific machine.
func PrintRawTCP(ip string, port int, payloadB64 string, timeout time.Duration) error {
	ip = strings.TrimSpace(ip)
	if ip == "" {
		return fmt.Errorf("network printer has no IP configured")
	}
	if port <= 0 {
		port = 9100
	}
	if timeout <= 0 {
		timeout = 15 * time.Second
	}
	payload, err := base64.StdEncoding.DecodeString(payloadB64)
	if err != nil {
		return fmt.Errorf("decode ESC/POS payload: %w", err)
	}
	addr := net.JoinHostPort(ip, strconv.Itoa(port))
	conn, err := net.DialTimeout("tcp", addr, timeout)
	if err != nil {
		return fmt.Errorf("cannot reach network printer at %s: %w", addr, err)
	}
	defer conn.Close()
	_ = conn.SetWriteDeadline(time.Now().Add(timeout))
	if _, err := conn.Write(payload); err != nil {
		return fmt.Errorf("write to network printer %s: %w", addr, err)
	}
	return nil
}
