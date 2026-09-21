package main

import (
	"encoding/base64"
	"io"
	"net"
	"testing"
	"time"
)

func TestPrintRawTCPStreamsPayload(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	defer listener.Close()
	port := listener.Addr().(*net.TCPAddr).Port

	received := make(chan []byte, 1)
	go func() {
		conn, err := listener.Accept()
		if err != nil {
			return
		}
		defer conn.Close()
		data, _ := io.ReadAll(conn)
		received <- data
	}()

	payload := []byte("\x1b@hello")
	if err := PrintRawTCP("127.0.0.1", port, base64.StdEncoding.EncodeToString(payload), 2*time.Second); err != nil {
		t.Fatalf("PrintRawTCP: %v", err)
	}

	select {
	case data := <-received:
		if string(data) != string(payload) {
			t.Fatalf("got %q, want %q", data, payload)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("listener did not receive the payload")
	}
}

func TestPrintRawTCPRejectsEmptyHost(t *testing.T) {
	if err := PrintRawTCP("  ", 9100, "", time.Second); err == nil {
		t.Fatal("expected error for empty host")
	}
}

func TestPrintRawTCPRejectsInvalidPayload(t *testing.T) {
	if err := PrintRawTCP("127.0.0.1", 9100, "not-base64!!", time.Second); err == nil {
		t.Fatal("expected error for invalid base64")
	}
}
