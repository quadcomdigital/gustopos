package main

import (
	"strconv"
	"sync"
	"time"
)

// AgentStatusSnapshot is the JSON shape served by the local dashboard and
// shipped (minus sensitive fields) to the API for remote diagnostics.
type AgentStatusSnapshot struct {
	BridgeID    string `json:"bridgeId"`
	APIBase     string `json:"apiBase"`
	InstanceID  string `json:"instanceId"`
	Version     string `json:"version"`
	OS          string `json:"os"`
	Paired      bool   `json:"paired"`
	QZConnected bool   `json:"qzConnected"`
	// Preflight is the last local validation of the QZ Tray installation
	// (override.crt, chain, validity, allowed.dat) — nil until first run.
	Preflight          *PreflightReport  `json:"preflight,omitempty"`
	DiscoveredPrinters []string          `json:"discoveredPrinters"`
	ClaimedAreas       []string          `json:"claimedAreas"`
	Mappings           map[string]string `json:"mappings"`
	LastHeartbeatAt    string            `json:"lastHeartbeatAt,omitempty"`
	LastClaimAt        string            `json:"lastClaimAt,omitempty"`
	LastError          string            `json:"lastError,omitempty"`
	Claimed            int64             `json:"claimed"`
	Printed            int64             `json:"printed"`
	Failed             int64             `json:"failed"`
}

type agentStatus struct {
	mu   sync.RWMutex
	snap AgentStatusSnapshot
}

func newAgentStatus() *agentStatus {
	return &agentStatus{snap: AgentStatusSnapshot{Mappings: map[string]string{}}}
}

func (s *agentStatus) SetConfig(cfg *Config) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.snap.BridgeID = cfg.BridgeID
	s.snap.APIBase = cfg.APIBase
	s.snap.InstanceID = cfg.InstanceID
	s.snap.Paired = cfg.IsPaired()
	s.snap.ClaimedAreas = append([]string(nil), cfg.Areas...)
	mappings := make(map[string]string, len(cfg.PrinterTargets)+len(cfg.PrinterNames))
	for area, target := range cfg.PrinterNames {
		mappings[area] = target
	}
	for area, target := range cfg.PrinterTargets {
		switch {
		case target.IP != "":
			port := target.Port
			if port <= 0 {
				port = 9100
			}
			mappings[area] = target.IP + ":" + strconv.Itoa(port)
		case target.Name != "":
			mappings[area] = target.Name
		}
	}
	s.snap.Mappings = mappings
	s.snap.DiscoveredPrinters = append([]string(nil), cfg.DiscoveredPrinters...)
}

func (s *agentStatus) SetQZConnected(connected bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.snap.QZConnected = connected
}

// SetPreflight stores the latest QZ preflight report for the dashboard and the
// diagnostics feed.
func (s *agentStatus) SetPreflight(report PreflightReport) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.snap.Preflight = &report
}

// GetPreflight returns the last report, or nil when none has run yet.
func (s *agentStatus) GetPreflight() *PreflightReport {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.snap.Preflight
}

func (s *agentStatus) SetPrinters(printers []string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.snap.DiscoveredPrinters = append([]string(nil), printers...)
}

func (s *agentStatus) SetAreas(areas []string, mappings map[string]string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.snap.ClaimedAreas = append([]string(nil), areas...)
	if mappings != nil {
		copied := make(map[string]string, len(mappings))
		for area, name := range mappings {
			copied[area] = name
		}
		s.snap.Mappings = copied
	}
}

func (s *agentStatus) MarkHeartbeat() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.snap.LastHeartbeatAt = time.Now().UTC().Format(time.RFC3339)
}

func (s *agentStatus) MarkClaim() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.snap.LastClaimAt = time.Now().UTC().Format(time.RFC3339)
}

func (s *agentStatus) RecordClaimed() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.snap.Claimed++
}

func (s *agentStatus) RecordPrinted() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.snap.Printed++
}

func (s *agentStatus) RecordFailed(errMsg string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.snap.Failed++
	if errMsg != "" {
		s.snap.LastError = errMsg
	}
}

func (s *agentStatus) RecordError(errMsg string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if errMsg != "" {
		s.snap.LastError = errMsg
	}
}

func (s *agentStatus) Snapshot() AgentStatusSnapshot {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := s.snap
	out.ClaimedAreas = append([]string(nil), s.snap.ClaimedAreas...)
	out.DiscoveredPrinters = append([]string(nil), s.snap.DiscoveredPrinters...)
	out.Mappings = make(map[string]string, len(s.snap.Mappings))
	for area, name := range s.snap.Mappings {
		out.Mappings[area] = name
	}
	return out
}

// JobRecord is a locally retained print/fiscal job outcome.
type JobRecord struct {
	JobID      string `json:"jobId"`
	OrderID    string `json:"orderId"`
	Area       string `json:"area"`
	Status     string `json:"status"`
	Error      string `json:"error,omitempty"`
	Timestamp  string `json:"timestamp"`
	DurationMs int64  `json:"durationMs"`
}

type jobHistory struct {
	mu      sync.Mutex
	records []JobRecord
	cap     int
}

func newJobHistory(capacity int) *jobHistory {
	if capacity < 8 {
		capacity = 8
	}
	return &jobHistory{records: make([]JobRecord, 0, capacity), cap: capacity}
}

func (h *jobHistory) Add(record JobRecord) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if record.Timestamp == "" {
		record.Timestamp = time.Now().UTC().Format(time.RFC3339)
	}
	if len(h.records) >= h.cap {
		copy(h.records, h.records[1:])
		h.records[len(h.records)-1] = record
		return
	}
	h.records = append(h.records, record)
}

// Snapshot returns the records newest-first (what the dashboard shows).
func (h *jobHistory) Snapshot() []JobRecord {
	h.mu.Lock()
	defer h.mu.Unlock()
	out := make([]JobRecord, len(h.records))
	for i, record := range h.records {
		out[len(h.records)-1-i] = record
	}
	return out
}

// AgentRuntime is the shared diagnostic state between the agent loop and the
// local dashboard. It is safe to use before pairing completes.
type AgentRuntime struct {
	Logs   *ringLog
	Status *agentStatus
	Jobs   *jobHistory
}

func newAgentRuntime() *AgentRuntime {
	return &AgentRuntime{
		Logs:   newRingLog(2000),
		Status: newAgentStatus(),
		Jobs:   newJobHistory(200),
	}
}
