package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"runtime"
	"strings"
	"time"
)

// HTTPStatusError carries the status code so callers can distinguish a
// revoked credential (401 → detached → re-pair) from transient failures.
type HTTPStatusError struct {
	Status int
	Msg    string
}

func (e *HTTPStatusError) Error() string {
	return fmt.Sprintf("API error %d: %s", e.Status, e.Msg)
}

// IsDetached reports whether the API rejected our credential (401), which
// means the onboarding secret was revoked server-side (bridge detached).
func IsDetached(err error) bool {
	var h *HTTPStatusError
	return errors.As(err, &h) && h.Status == http.StatusUnauthorized
}

// API talks to the GustoPOS API using the bridge protocol:
//   - X-Print-Bridge-Key: the 6-digit pairing code (or onboarding secret)
//   - X-Bridge-Instance-Id: stable per-machine UUID for claim ownership
type API struct {
	Base       string
	SignBase   string // origin of the QZ signing endpoints (defaults to Base)
	Code       string
	InstanceID string
	Client     *http.Client
}

func NewAPI(base, signBase, code, instanceID string) *API {
	// Normalize both freshly paired and persisted configurations. Older agents
	// could save `https://host/api`, but signing is served at the origin root.
	// Applying this here fixes existing installations before their first QZ
	// certificate request, not only new pairing attempts.
	normalizedBase := normalizeServerURL(base)
	if normalizedBase == "" && strings.TrimSpace(base) != "" {
		normalizedBase = strings.TrimRight(strings.TrimSpace(base), "/")
	}
	rawSignBase := ifEmpty(signBase, normalizedBase)
	normalizedSignBase := normalizeServerURL(rawSignBase)
	if normalizedSignBase == "" && strings.TrimSpace(rawSignBase) != "" {
		normalizedSignBase = strings.TrimRight(strings.TrimSpace(rawSignBase), "/")
	}
	return &API{
		Base:       normalizedBase,
		SignBase:   normalizedSignBase,
		Code:       code,
		InstanceID: instanceID,
		Client:     &http.Client{Timeout: 15 * time.Second},
	}
}

func (a *API) headers() http.Header {
	h := http.Header{}
	h.Set("Content-Type", "application/json")
	h.Set("X-Print-Bridge-Key", a.Code)
	h.Set("X-Bridge-Instance-Id", a.InstanceID)
	return h
}

// do performs a JSON request and decodes the response into out (if non-nil).
func (a *API) do(method, path string, body any, out any) error {
	var reader io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reader = bytes.NewReader(raw)
	}
	req, err := http.NewRequest(method, a.Base+path, reader)
	if err != nil {
		return err
	}
	req.Header = a.headers()
	resp, err := a.Client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	if resp.StatusCode >= 300 {
		return &HTTPStatusError{Status: resp.StatusCode, Msg: strings.TrimSpace(string(data))}
	}
	if out != nil && len(data) > 0 {
		if err := json.Unmarshal(data, out); err != nil {
			return err
		}
	}
	return nil
}

// ─── Heartbeat ─────────────────────────────────────────────────────────

type HeartbeatRequest struct {
	BridgeID string                    `json:"bridgeId"`
	Name     string                    `json:"name,omitempty"`
	Host     string                    `json:"host,omitempty"`
	Version  string                    `json:"version,omitempty"`
	Areas    []string                  `json:"areas"`
	Printers []BridgePrinterCapability `json:"printers"`
}

// BridgePrinterCapability is a printer the agent can see: a QZ-installed
// printer (source "qz") or a raw network printer discovered on the LAN
// (source "net", with ip/port). The server persists these for the admin UI.
type BridgePrinterCapability struct {
	Name   string `json:"name"`
	IP     string `json:"ip,omitempty"`
	Port   int    `json:"port,omitempty"`
	Source string `json:"source,omitempty"`
	Vendor string `json:"vendor,omitempty"`
}

type BridgePrinterMapping struct {
	Area string `json:"area"`
	Name string `json:"name"`
	IP   string `json:"ip"`
	Port int    `json:"port"`
}

type HeartbeatResponse struct {
	Bridge struct {
		ID           string                 `json:"id"`
		TenantID     string                 `json:"tenantId"`
		Status       string                 `json:"status"`
		Areas        []string               `json:"areas"`
		ClaimedAreas []string               `json:"claimedAreas"`
		Mappings     []BridgePrinterMapping `json:"mappings"`
	} `json:"bridge"`
	ServerTime string `json:"serverTime"`
	// Command is a one-shot admin request (network scan / direct test print).
	// The agent executes it, acks it, and the server clears it.
	Command *BridgeCommand `json:"command,omitempty"`
	// Certified fiscal (Path B): the tenant's RT printer config when the admin
	// configured a device in the web UI. Applied over the local config on
	// receipt so the server remains the source of truth for host/port/model.
	FiscalPrinter *FiscalPrinter `json:"fiscalPrinter,omitempty"`
}

// BridgeCommand is a one-shot instruction pushed by the API in the heartbeat
// response. type "scan" asks the agent to scan the LAN; "test-print" asks it
// to print an identification ticket straight to ip:port.
type BridgeCommand struct {
	ID    string `json:"id"`
	Type  string `json:"type"`
	IP    string `json:"ip,omitempty"`
	Port  int    `json:"port,omitempty"`
	Label string `json:"label,omitempty"`
}

// Heartbeat registers this bridge under the tenant resolved from the code.
// The first call binds the code to this bridgeId (permanent until revoked).
func (a *API) Heartbeat(cfg *Config, printers []BridgePrinterCapability) (*HeartbeatResponse, error) {
	host, _ := os.Hostname()
	// Administrative area mappings are returned separately by the API and must
	// not be sent back as capabilities: the server owns those mappings.
	if printers == nil {
		printers = []BridgePrinterCapability{}
	}
	req := HeartbeatRequest{
		BridgeID: cfg.BridgeID,
		Name:     cfg.BridgeID,
		Host:     host,
		Version:  "go-" + version,
		Areas:    cfg.Areas,
		Printers: printers,
	}
	var out HeartbeatResponse
	if err := a.do(http.MethodPost, "/api/print-bridge/heartbeat", req, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// ReportDiscoveredDevices ships the network-scan result to the API. The server
// merges it into the bridge's printer list and clears the discovery flag.
func (a *API) ReportDiscoveredDevices(bridgeID string, devices []DiscoveredDevice) error {
	return a.do(http.MethodPost, "/api/print-bridge/discovered-printers",
		map[string]any{"bridgeId": bridgeID, "devices": devices}, nil)
}

// AckCommand tells the API a one-shot command has been executed so it can be
// cleared and not delivered again. ok/error carry the execution outcome so
// the server can log failures (e.g. test print to an unreachable IP) in the
// admin-visible diagnostics; older servers ignore the extra fields.
func (a *API) AckCommand(bridgeID, commandID string, ok bool, errMsg string) error {
	payload := map[string]any{"bridgeId": bridgeID, "commandId": commandID, "ok": ok}
	if errMsg != "" {
		payload["error"] = errMsg
	}
	return a.do(http.MethodPost, "/api/print-bridge/command-ack", payload, nil)
}

// ─── Claim / complete / fail ───────────────────────────────────────────

type PrintJob struct {
	ID      string `json:"id"`
	OrderID string `json:"orderId"`
	Area    string `json:"area"`
	Status  string `json:"status"`
	Payload string `json:"payload"`
}

type ClaimResponse struct {
	Jobs []PrintJob `json:"jobs"`
}

func (a *API) Claim(bridgeID string, limit int) ([]PrintJob, error) {
	var out ClaimResponse
	err := a.do(http.MethodPost, "/api/print-bridge/claim",
		map[string]any{"bridgeId": bridgeID, "limit": limit}, &out)
	return out.Jobs, err
}

func (a *API) Complete(bridgeID, jobID string) error {
	return a.do(http.MethodPost, "/api/print-bridge/jobs/"+url.PathEscape(jobID)+"/complete",
		map[string]any{"bridgeId": bridgeID}, nil)
}

func (a *API) Fail(bridgeID, jobID, errMsg string) error {
	if len(errMsg) > 500 {
		errMsg = errMsg[:500]
	}
	return a.do(http.MethodPost, "/api/print-bridge/jobs/"+url.PathEscape(jobID)+"/fail",
		map[string]any{"bridgeId": bridgeID, "error": errMsg}, nil)
}

// ─── Fiscal jobs (certified RT printer) ─────────────────────────────────

type FiscalClaimResponse struct {
	Jobs []FiscalJob `json:"jobs"`
}

func (a *API) ClaimFiscal(bridgeID string, limit int) ([]FiscalJob, error) {
	var out FiscalClaimResponse
	err := a.do(http.MethodPost, "/api/fiscal-bridge/claim",
		map[string]any{"bridgeId": bridgeID, "limit": limit}, &out)
	return out.Jobs, err
}

func (a *API) CompleteFiscal(bridgeID, jobID, progressive string) error {
	return a.do(http.MethodPost, "/api/fiscal-bridge/jobs/"+url.PathEscape(jobID)+"/complete",
		map[string]any{"bridgeId": bridgeID, "progressive": progressive}, nil)
}

func (a *API) FailFiscal(bridgeID, jobID, errMsg string) error {
	if len(errMsg) > 500 {
		errMsg = errMsg[:500]
	}
	return a.do(http.MethodPost, "/api/fiscal-bridge/jobs/"+url.PathEscape(jobID)+"/fail",
		map[string]any{"bridgeId": bridgeID, "error": errMsg}, nil)
}

// ─── Diagnostics (agent logs + health) ─────────────────────────────────

type DiagnosticsLogEntry struct {
	Timestamp string `json:"timestamp"`
	Level     string `json:"level"`
	Component string `json:"component,omitempty"`
	Message   string `json:"message"`
}

type DiagnosticsRequest struct {
	BridgeID   string                `json:"bridgeId"`
	InstanceID string                `json:"instanceId,omitempty"`
	Version    string                `json:"version,omitempty"`
	OS         string                `json:"os,omitempty"`
	LastError  string                `json:"lastError,omitempty"`
	Logs       []DiagnosticsLogEntry `json:"logs"`
}

// PushDiagnostics ships a compact log/health batch to the API so admins can
// inspect a remote POS agent from Settings. Best-effort: the caller logs but
// does not fail the agent on error.
func (a *API) PushDiagnostics(cfg *Config, logs []DiagnosticsLogEntry, lastError string) error {
	req := DiagnosticsRequest{
		BridgeID:   cfg.BridgeID,
		InstanceID: cfg.InstanceID,
		Version:    "go-" + version,
		OS:         runtime.GOOS,
		LastError:  lastError,
		Logs:       logs,
	}
	return a.do(http.MethodPost, "/api/print-bridge/diagnostics", req, nil)
}

// ─── QZ Tray signing ───────────────────────────────────────────────────
// SignQzMessage returns the base64 RSA-SHA512 signature over the SHA-256 hex
// digest of the JSON payload — exactly the QZ Tray verification protocol
// (SHA-256(json) → hex → SHA512withRSA). The server signs on our behalf; no
// private key ever touches the POS machine.
func (a *API) SignQzMessage(jsonPayload string) (string, error) {
	sum := sha256.Sum256([]byte(jsonPayload))
	hexHash := hex.EncodeToString(sum[:])
	u := a.SignBase + "/api/print-bridge/sign?request=" + url.QueryEscape(hexHash)
	req, err := http.NewRequest(http.MethodGet, u, nil)
	if err != nil {
		return "", err
	}
	req.Header = a.headers()
	resp, err := a.Client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	if resp.StatusCode >= 300 {
		return "", fmt.Errorf("sign endpoint HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(data)))
	}
	return strings.TrimSpace(string(data)), nil
}

// FetchCertificate returns the QZ Tray signing certificate (PEM). QZ Tray
// must already trust this certificate (installed via the cert installers).
func (a *API) FetchCertificate() (string, error) {
	resp, err := a.Client.Get(a.SignBase + "/signing/digital-certificate.txt")
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	if resp.StatusCode >= 300 {
		return "", fmt.Errorf("cert endpoint HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(data)))
	}
	return string(data), nil
}

func ifEmpty(v, fallback string) string {
	if strings.TrimSpace(v) == "" {
		return fallback
	}
	return v
}
