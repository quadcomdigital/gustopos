package main

import (
	"context"
	"net"
	"testing"
	"time"
)

func TestHostsInExcludesNetworkAndBroadcast(t *testing.T) {
	_, network, err := net.ParseCIDR("192.168.1.0/30")
	if err != nil {
		t.Fatalf("parse cidr: %v", err)
	}
	hosts := hostsIn(network)
	if len(hosts) != 2 || hosts[0] != "192.168.1.1" || hosts[1] != "192.168.1.2" {
		t.Fatalf("unexpected hosts: %#v", hosts)
	}
}

func TestScanNetworksFindsOpenPort(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	defer listener.Close()
	port := listener.Addr().(*net.TCPAddr).Port
	go func() {
		for {
			conn, err := listener.Accept()
			if err != nil {
				return
			}
			_ = conn.Close()
		}
	}()

	_, network, _ := net.ParseCIDR("127.0.0.0/30")
	devices := scanNetworks(context.Background(), []net.IPNet{*network}, port, 500*time.Millisecond, 8)
	found := false
	for _, device := range devices {
		if device.IP == "127.0.0.1" && device.Port == port && device.Source == "net" {
			found = true
		}
	}
	if !found {
		t.Fatalf("expected to discover 127.0.0.1:%d, got %#v", port, devices)
	}
}

func TestOUIVendor(t *testing.T) {
	if got := ouiVendor("00:00:48:AA:BB:CC"); got != "Seiko Epson" {
		t.Fatalf("ouiVendor = %q, want Seiko Epson", got)
	}
	if got := ouiVendor("aa:bb:cc:dd:ee:ff"); got != "" {
		t.Fatalf("ouiVendor unknown = %q, want empty", got)
	}
}
