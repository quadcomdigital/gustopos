package main

import (
	"regexp"
	"strings"
	"testing"
)

func TestCommandsForModelGenericRT(t *testing.T) {
	cmd := commandsForModel("generic-rt")
	if cmd.OpenReceipt != "@A" {
		t.Fatalf("expected @A open, got %q", cmd.OpenReceipt)
	}
	if cmd.CloseReceipt != "@E" {
		t.Fatalf("expected @E close, got %q", cmd.CloseReceipt)
	}
	if cmd.Chiusura != "@F" {
		t.Fatalf("expected @F chiusura, got %q", cmd.Chiusura)
	}
}

func TestCommandsForModelEpson(t *testing.T) {
	cmd := commandsForModel("epson-tm-s1000")
	if cmd.Line != "{qty}@{price}L{desc}" {
		t.Fatalf("unexpected line template: %q", cmd.Line)
	}
}

func TestFiscalProgressiveRegex(t *testing.T) {
	cases := map[string]string{
		"prog. 000123": "000123",
		"NR=0000042":   "0000042",
		"doc 7":        "7",
		"ok":           "",
	}
	for response, want := range cases {
		m := fiscalProgressiveRe.FindStringSubmatch(response)
		got := ""
		if len(m) > 1 {
			got = m[1]
		}
		if got != want {
			t.Errorf("response %q: got progressive %q, want %q", response, got, want)
		}
	}
}

func TestFiscalAddressDefaults(t *testing.T) {
	p := &FiscalPrinter{Host: "192.168.1.50"}
	if addr := p.address(); addr != "192.168.1.50:4001" {
		t.Fatalf("expected default port 4001, got %q", addr)
	}
	p.Port = 9100
	if addr := p.address(); addr != "192.168.1.50:9100" {
		t.Fatalf("expected port 9100, got %q", addr)
	}
}

func TestEmitReceiptLineBuilding(t *testing.T) {
	client := newGenericFiscalClient(&FiscalPrinter{Host: "127.0.0.1", Model: "generic-rt"})
	// Do not open a real socket here; exercise the pure line-building path by
	// inspecting what the command set produces for a sample item.
	cmd := client.cmd
	line := strings.ReplaceAll(cmd.Line, "{qty}", "2")
	line = strings.ReplaceAll(line, "{price}", "8.50")
	line = strings.ReplaceAll(line, "{desc}", "Pizza")
	if line != "2@8.50LPizza" {
		t.Fatalf("unexpected item line: %q", line)
	}
}

func TestSanitizeRTTextStripsCommandInjectors(t *testing.T) {
	cases := map[string]string{
		"Pizza":         "Pizza",
		"Pizza@P":       "PizzaP",
		"Coca\n@E":     "CocaE",
		"\t\r@A":       "A",
		"X\x00Y":       "XY",
	}
	for input, want := range cases {
		if got := sanitizeRTText(input); got != want {
			t.Errorf("sanitizeRTText(%q) = %q, want %q", input, got, want)
		}
	}
}

func TestSanitizeRTTextCapsAtReceiptWidth(t *testing.T) {
	long := strings.Repeat("a", 80)
	if got := sanitizeRTText(long); len(got) != 42 {
		t.Fatalf("expected 42-char cap, got %d: %q", len(got), got)
	}
}

func TestHasArea(t *testing.T) {
	cases := []struct {
		areas []string
		area  string
		want  bool
	}{
		{[]string{"kitchen", "bar", "cashier"}, "cashier", true},
		{[]string{"kitchen"}, "cashier", false},
		{nil, "cashier", false},
		{[]string{"cashier"}, "cashier", true},
	}
	for _, tc := range cases {
		if got := hasArea(tc.areas, tc.area); got != tc.want {
			t.Errorf("hasArea(%v, %q) = %v, want %v", tc.areas, tc.area, got, tc.want)
		}
	}
}

// Keep the regexp import used (progressive parsing is tested above).
var _ = regexp.MustCompile
