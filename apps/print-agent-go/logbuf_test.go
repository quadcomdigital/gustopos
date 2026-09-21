package main

import (
	"testing"
)

func TestRingLogTrimsToCapacity(t *testing.T) {
	logs := newRingLog(16)
	for i := 0; i < 100; i++ {
		logs.Append(LogEntry{Level: "info", Message: "entry"})
	}
	if got := len(logs.Snapshot()); got != 16 {
		t.Fatalf("capacity not enforced: got %d entries", got)
	}
	entries, latest := logs.Since(0)
	if len(entries) != 16 {
		t.Fatalf("Since(0) returned %d entries", len(entries))
	}
	if latest != 100 {
		t.Fatalf("latest seq = %d, want 100", latest)
	}
	// Only entries after the cursor.
	entries, _ = logs.Since(95)
	if len(entries) != 5 {
		t.Fatalf("Since(95) returned %d entries, want 5", len(entries))
	}
}

func TestRingLogWriterParsesLevelAndComponent(t *testing.T) {
	logs := newRingLog(16)
	_, _ = logs.Write([]byte("2026/09/21 10:00:00 [print-agent] [dashboard] job failed: boom\n"))
	_, _ = logs.Write([]byte("2026/09/21 10:00:01 [print-agent] connected to QZ Tray\n"))

	entries := logs.Snapshot()
	if len(entries) != 2 {
		t.Fatalf("expected 2 entries, got %d", len(entries))
	}
	if entries[0].Level != levelError {
		t.Fatalf("first entry level = %q, want error", entries[0].Level)
	}
	if entries[0].Component != "dashboard" {
		t.Fatalf("first entry component = %q, want dashboard", entries[0].Component)
	}
	if entries[1].Level != levelInfo {
		t.Fatalf("second entry level = %q, want info", entries[1].Level)
	}
}

func TestJobHistoryNewestFirst(t *testing.T) {
	jobs := newJobHistory(8)
	jobs.Add(JobRecord{JobID: "a", Status: "printed"})
	jobs.Add(JobRecord{JobID: "b", Status: "failed", Error: "x"})
	records := jobs.Snapshot()
	if len(records) != 2 || records[0].JobID != "b" || records[1].JobID != "a" {
		t.Fatalf("unexpected order: %+v", records)
	}
}
