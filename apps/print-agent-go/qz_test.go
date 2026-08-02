package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func TestNormalizeServerURLStripsLegacyAPISuffix(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{input: "https://test.franksbar.it/api", want: "https://test.franksbar.it"},
		{input: "https://test.franksbar.it/api/", want: "https://test.franksbar.it"},
		{input: "https://test.franksbar.it", want: "https://test.franksbar.it"},
		{input: "test.franksbar.it/api", want: "https://test.franksbar.it"},
	}
	for _, tt := range tests {
		if got := normalizeServerURL(tt.input); got != tt.want {
			t.Errorf("normalizeServerURL(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestPairingServerPreservesInstanceIDOnRepair(t *testing.T) {
	previous := &Config{InstanceID: "stable-instance"}
	server, err := StartPairingServer("https://test.franksbar.it", previous)
	if err != nil {
		t.Fatalf("start pairing server: %v", err)
	}
	defer server.Stop()
	if server.instanceID != previous.InstanceID {
		t.Fatalf("instance ID changed on re-pair: got %q, want %q", server.instanceID, previous.InstanceID)
	}
}

func TestNewAPINormalizesPersistedLegacyOrigin(t *testing.T) {
	api := NewAPI("https://test.franksbar.it/api/", "", "123456", "instance-test")
	if api.Base != "https://test.franksbar.it" {
		t.Fatalf("Base = %q, want root origin", api.Base)
	}
	if api.SignBase != "https://test.franksbar.it" {
		t.Fatalf("SignBase = %q, want root origin", api.SignBase)
	}
}

func TestHeartbeatReportsDiscoveredPrinters(t *testing.T) {
	var received HeartbeatRequest
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := json.NewDecoder(r.Body).Decode(&received); err != nil {
			t.Errorf("decode heartbeat: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"bridge":{"id":"bridge_test"},"serverTime":"2026-08-01T00:00:00Z"}`))
	}))
	defer server.Close()

	api := NewAPI(server.URL, "", "123456", "instance-test")
	cfg := &Config{BridgeID: "bridge_test", Areas: []string{"kitchen"}, PrinterNames: map[string]string{"kitchen": "old-config"}}
	if _, err := api.Heartbeat(cfg, []string{"Star TSP100", "EPSON TM-T88V"}); err != nil {
		t.Fatalf("heartbeat: %v", err)
	}
	if len(received.Printers) != 2 || received.Printers[0]["name"] != "Star TSP100" || received.Printers[1]["name"] != "EPSON TM-T88V" {
		t.Fatalf("unexpected discovered printers payload: %#v", received.Printers)
	}
	if received.Printers[0]["area"] != nil || received.Printers[1]["area"] != nil {
		t.Fatalf("discovery payload must not masquerade as area mappings: %#v", received.Printers)
	}
}

func TestFindPrintersUsesQZDiscoveryProtocol(t *testing.T) {
	upgrader := websocket.Upgrader{CheckOrigin: func(*http.Request) bool { return true }}
	signedPayload := make(chan string, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		defer conn.Close()

		sequence := 0
		for {
			_, raw, err := conn.ReadMessage()
			if err != nil {
				return
			}
			var request struct {
				UID         string          `json:"uid"`
				Call        string          `json:"call"`
				Certificate string          `json:"certificate"`
				Params      json.RawMessage `json:"params"`
				Timestamp   int64           `json:"timestamp"`
				Signature   string          `json:"signature"`
				Algorithm   string          `json:"signAlgorithm"`
			}
			if err := json.Unmarshal(raw, &request); err != nil {
				t.Errorf("QZ received invalid JSON: %v; raw=%s", err, raw)
				return
			}
			if request.UID == "" {
				t.Errorf("QZ request is missing uid: %s", raw)
				return
			}

			switch request.Call {
			case "getVersion":
				if sequence != 0 {
					t.Errorf("getVersion must be the first QZ request, sequence=%d", sequence)
				}
				if request.Timestamp == 0 {
					t.Errorf("getVersion must include timestamp: %s", raw)
				}
				sequence++
				_ = conn.WriteJSON(map[string]any{"uid": request.UID, "result": "2.2.6"})
			case "": // QZ certificate registration handshake.
				if sequence != 1 {
					t.Errorf("certificate must follow getVersion, sequence=%d", sequence)
				}
				if request.Certificate == "" {
					t.Errorf("certificate handshake omitted certificate: %s", raw)
				}
				sequence++
				_ = conn.WriteJSON(map[string]any{"uid": request.UID, "result": nil})
			case "printers.find":
				if sequence != 2 {
					t.Errorf("printers.find must follow getVersion and certificate, sequence=%d", sequence)
				}
				var params map[string]any
				if err := json.Unmarshal(request.Params, &params); err != nil {
					t.Errorf("printers.find params must be an object: %v; raw=%s", err, raw)
					return
				}
				if len(params) != 0 {
					t.Errorf("expected empty discovery params object, got %s", request.Params)
				}
				if request.Timestamp == 0 || request.Signature != "test-signature" || request.Algorithm != "SHA512" {
					t.Errorf("printers.find must use SHA512 signing: %s", raw)
				}
				var payload string
				select {
				case payload = <-signedPayload:
				case <-time.After(time.Second):
					t.Errorf("timed out waiting for signed payload")
					return
				}
				expectedPayload := fmt.Sprintf(`{"call":"printers.find","params":{},"timestamp":%d}`, request.Timestamp)
				if payload != expectedPayload {
					t.Errorf("signed payload mismatch: got %s, want %s", payload, expectedPayload)
				}
				_ = conn.WriteJSON(map[string]any{
					"uid":    request.UID,
					"result": []string{"EPSON TM-T88V", "Star TSP100"},
				})
				return
			default:
				t.Errorf("unexpected QZ call %q: %s", request.Call, raw)
				return
			}
		}
	}))
	defer server.Close()

	qzURL := "ws" + strings.TrimPrefix(server.URL, "http")
	qz := NewQZClient(qzURL, "-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----", func(payload string) (string, error) {
		if !strings.Contains(payload, `"call":"printers.find"`) {
			t.Fatalf("unexpected signed payload: %s", payload)
		}
		signedPayload <- payload
		return "test-signature", nil
	})
	defer qz.Close()

	if err := qz.Connect(); err != nil {
		t.Fatalf("connect: %v", err)
	}
	printers, err := qz.FindPrinters(2 * time.Second)
	if err != nil {
		t.Fatalf("find printers: %v", err)
	}

	expected := []string{"EPSON TM-T88V", "Star TSP100"}
	if len(printers) != len(expected) {
		t.Fatalf("expected %d printers, got %v", len(expected), printers)
	}
	for i := range expected {
		if printers[i] != expected[i] {
			t.Errorf("printer[%d]: expected %q, got %q", i, expected[i], printers[i])
		}
	}
}
