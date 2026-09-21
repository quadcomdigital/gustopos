package main

import (
	"strings"
	"sync"
	"time"
)

// LogLevel mirrors the shared contract printBridgeLogLevelSchema.
const (
	levelInfo  = "info"
	levelWarn  = "warn"
	levelError = "error"
)

// LogEntry is a single diagnostic log line shipped to the API and shown in the
// local dashboard.
type LogEntry struct {
	Seq       int64  `json:"seq"`
	Timestamp string `json:"timestamp"`
	Level     string `json:"level"`
	Component string `json:"component,omitempty"`
	Message   string `json:"message"`
}

// ringLog is a bounded, concurrency-safe log buffer. It also implements
// io.Writer and is installed as a slog/stdlib-log sink, so every existing
// log.Printf in the agent is captured without rewriting call sites.
type ringLog struct {
	mu      sync.Mutex
	entries []LogEntry
	cap     int
	nextSeq int64
}

func newRingLog(capacity int) *ringLog {
	if capacity < 16 {
		capacity = 16
	}
	return &ringLog{entries: make([]LogEntry, 0, capacity), cap: capacity}
}

// Append adds a structured entry. It returns the assigned sequence number.
func (r *ringLog) Append(entry LogEntry) int64 {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.nextSeq++
	entry.Seq = r.nextSeq
	if entry.Timestamp == "" {
		entry.Timestamp = time.Now().UTC().Format(time.RFC3339)
	}
	if len(r.entries) >= r.cap {
		copy(r.entries, r.entries[1:])
		r.entries[len(r.entries)-1] = entry
		return entry.Seq
	}
	r.entries = append(r.entries, entry)
	return entry.Seq
}

// Write parses a stdlib log line into a structured entry (best-effort level and
// component detection) and appends it.
func (r *ringLog) Write(p []byte) (int, error) {
	line := strings.TrimRight(string(p), "\n")
	if line == "" {
		return len(p), nil
	}
	msg := line
	// Strip the "2006/01/02 15:04:05 " date/time prefix from log.LstdFlags.
	if len(msg) > 20 && msg[4] == '/' && msg[7] == '/' && msg[10] == ' ' {
		msg = msg[20:]
	}
	msg = strings.TrimPrefix(msg, "[print-agent] ")

	component := ""
	if strings.HasPrefix(msg, "[") {
		if i := strings.Index(msg, "]"); i > 0 {
			component = msg[1:i]
			msg = strings.TrimSpace(msg[i+1:])
		}
	}

	lower := strings.ToLower(msg)
	level := levelInfo
	switch {
	case strings.Contains(lower, "error") || strings.Contains(lower, "failed") || strings.Contains(lower, "cannot"):
		level = levelError
	case strings.Contains(lower, "warn") || strings.Contains(lower, "offline") || strings.Contains(lower, "detached"):
		level = levelWarn
	}

	r.Append(LogEntry{Level: level, Component: component, Message: msg})
	return len(p), nil
}

// Snapshot returns a copy of the most recent entries (oldest first).
func (r *ringLog) Snapshot() []LogEntry {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make([]LogEntry, len(r.entries))
	copy(out, r.entries)
	return out
}

// Since returns entries with Seq greater than after, plus the highest Seq seen
// so a shipping cursor can advance even when the buffer was trimmed.
func (r *ringLog) Since(after int64) ([]LogEntry, int64) {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make([]LogEntry, 0)
	for _, entry := range r.entries {
		if entry.Seq > after {
			out = append(out, entry)
		}
	}
	return out, r.nextSeq
}
