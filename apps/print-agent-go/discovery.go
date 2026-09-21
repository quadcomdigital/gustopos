package main

import (
	"bufio"
	"context"
	"fmt"
	"log"
	"net"
	"os/exec"
	"runtime"
	"strings"
	"sync"
	"time"
)

// DiscoveredDevice is a network printer candidate found on the agent's LAN.
// It is reported to the API on the heartbeat's `printers` list so the admin
// can bind a station to an IP regardless of which machine discovered it.
type DiscoveredDevice struct {
	IP     string `json:"ip"`
	Port   int    `json:"port"`
	MAC    string `json:"mac,omitempty"`
	Vendor string `json:"vendor,omitempty"`
	Source string `json:"source"` // always "net"
}

const (
	discoveryPort        = 9100 // raw/JetDirect printing
	discoveryTimeout     = 400 * time.Millisecond
	discoveryConcurrency = 64
	discoveryMaxHosts    = 1024 // skip subnets larger than this (e.g. > /22)
)

// localPrivateSubnets returns the RFC1918 IPv4 subnets this machine is
// attached to. Discovery is deliberately limited to private ranges so a
// misconfigured agent can never scan the public internet.
func localPrivateSubnets() []net.IPNet {
	ifaces, err := net.Interfaces()
	if err != nil {
		log.Printf("network discovery: cannot list interfaces: %v", err)
		return nil
	}
	seen := map[string]struct{}{}
	var subnets []net.IPNet
	for _, iface := range ifaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			ipNet, ok := addr.(*net.IPNet)
			if !ok {
				continue
			}
			ip4 := ipNet.IP.To4()
			if ip4 == nil || !ip4.IsPrivate() {
				continue
			}
			mask := ipNet.Mask
			if len(mask) == 16 {
				mask = mask[12:]
			}
			network := net.IPNet{IP: ip4.Mask(mask), Mask: mask}
			key := network.String()
			if _, ok := seen[key]; ok {
				continue
			}
			if hostCount(&network) > discoveryMaxHosts {
				log.Printf("network discovery: skipping %s (too large)", key)
				continue
			}
			seen[key] = struct{}{}
			subnets = append(subnets, network)
		}
	}
	return subnets
}

func hostCount(network *net.IPNet) int {
	ones, bits := network.Mask.Size()
	if bits == 0 {
		return 0
	}
	return 1 << (bits - ones)
}

// hostsIn enumerates usable host addresses of a subnet, excluding the network
// and broadcast addresses.
func hostsIn(network *net.IPNet) []string {
	var hosts []string
	ip := network.IP.Mask(network.Mask).To4()
	if ip == nil {
		return nil
	}
	for cur := cloneIP(ip); network.Contains(cur); incIP(cur) {
		if cur.Equal(network.IP.Mask(network.Mask)) {
			continue // network address
		}
		hosts = append(hosts, cur.String())
	}
	// Drop the broadcast address (last one) when the subnet is small enough.
	if len(hosts) > 0 {
		hosts = hosts[:len(hosts)-1]
	}
	return hosts
}

func cloneIP(ip net.IP) net.IP {
	out := make(net.IP, len(ip))
	copy(out, ip)
	return out
}

func incIP(ip net.IP) {
	for i := len(ip) - 1; i >= 0; i-- {
		ip[i]++
		if ip[i] != 0 {
			return
		}
	}
}

// scanNetworks probes `port` on every host of the given subnets with a bounded
// worker pool and a short dial timeout. Open port 9100 is a strong signal of a
// raw ESC/POS network printer.
func scanNetworks(ctx context.Context, subnets []net.IPNet, port int, timeout time.Duration, concurrency int) []DiscoveredDevice {
	if port <= 0 {
		port = discoveryPort
	}
	if timeout <= 0 {
		timeout = discoveryTimeout
	}
	if concurrency <= 0 {
		concurrency = discoveryConcurrency
	}
	var hosts []string
	for i := range subnets {
		hosts = append(hosts, hostsIn(&subnets[i])...)
	}
	if len(hosts) == 0 {
		return nil
	}

	results := make(chan string, len(hosts))
	sem := make(chan struct{}, concurrency)
	var wg sync.WaitGroup
	for _, host := range hosts {
		host := host
		wg.Add(1)
		sem <- struct{}{}
		go func() {
			defer wg.Done()
			defer func() { <-sem }()
			dialer := net.Dialer{Timeout: timeout}
			conn, err := dialer.DialContext(ctx, "tcp", net.JoinHostPort(host, fmt.Sprintf("%d", port)))
			if err != nil {
				return
			}
			_ = conn.Close()
			results <- host
		}()
	}
	wg.Wait()
	close(results)

	macs := arpTable()
	devices := make([]DiscoveredDevice, 0)
	seen := map[string]struct{}{}
	for host := range results {
		if _, ok := seen[host]; ok {
			continue
		}
		seen[host] = struct{}{}
		mac := macs[host]
		devices = append(devices, DiscoveredDevice{
			IP:     host,
			Port:   port,
			MAC:    mac,
			Vendor: ouiVendor(mac),
			Source: "net",
		})
	}
	return devices
}

// DiscoverNetworkDevices is the orchestrator used by the agent: enumerate the
// local private subnets and probe them for raw network printers.
func DiscoverNetworkDevices(ctx context.Context) []DiscoveredDevice {
	subnets := localPrivateSubnets()
	if len(subnets) == 0 {
		log.Printf("network discovery: no private IPv4 subnet found")
		return nil
	}
	names := make([]string, 0, len(subnets))
	for _, subnet := range subnets {
		names = append(names, subnet.String())
	}
	log.Printf("network discovery: scanning %s on port %d", strings.Join(names, ", "), discoveryPort)
	started := time.Now()
	devices := scanNetworks(ctx, subnets, discoveryPort, discoveryTimeout, discoveryConcurrency)
	log.Printf("network discovery: %d device(s) with port %d open in %s", len(devices), discoveryPort, time.Since(started).Round(time.Millisecond))
	return devices
}

// arpTable returns ip -> MAC from the OS neighbour table. Best effort: an
// unavailable command simply yields no MAC addresses.
func arpTable() map[string]string {
	table := map[string]string{}
	switch runtime.GOOS {
	case "windows":
		collectARP(table, "arp", "-a")
	case "darwin":
		collectARP(table, "arp", "-an")
	default:
		collectARP(table, "ip", "neigh")
		if len(table) == 0 {
			collectARP(table, "arp", "-an")
		}
	}
	return table
}

func collectARP(table map[string]string, name string, args ...string) {
	out, err := exec.Command(name, args...).Output()
	if err != nil {
		return
	}
	scanner := bufio.NewScanner(strings.NewReader(string(out)))
	for scanner.Scan() {
		line := scanner.Text()
		ip := extractIPv4(line)
		mac := extractMAC(line)
		if ip != "" && mac != "" {
			table[ip] = mac
		}
	}
}

func extractIPv4(line string) string {
	for _, field := range strings.FieldsFunc(line, func(r rune) bool { return r == ' ' || r == '\t' || r == '(' || r == ')' || r == ',' }) {
		ip := net.ParseIP(field)
		if ip != nil && ip.To4() != nil {
			return ip.String()
		}
	}
	return ""
}

func extractMAC(line string) string {
	for _, field := range strings.FieldsFunc(line, func(r rune) bool { return r == ' ' || r == '\t' }) {
		if isMAC(field) {
			return strings.ToLower(field)
		}
	}
	return ""
}

func isMAC(value string) bool {
	if len(value) != 17 {
		return false
	}
	for i, r := range value {
		if (i+1)%3 == 0 {
			if r != ':' && r != '-' {
				return false
			}
			continue
		}
		if !((r >= '0' && r <= '9') || (r >= 'a' && r <= 'f') || (r >= 'A' && r <= 'F')) {
			return false
		}
	}
	return true
}
