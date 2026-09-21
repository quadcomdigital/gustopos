package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestExitRecordRoundTrip(t *testing.T) {
	t.Setenv("GUSTOPOS_AGENT_CONFIG", filepath.Join(t.TempDir(), "config.json"))
	writeExitRecord("update:9.9.9")
	raw, err := os.ReadFile(exitRecordPath())
	if err != nil {
		t.Fatalf("read exit record: %v", err)
	}
	if !strings.Contains(string(raw), `"reason":"update:9.9.9"`) {
		t.Fatalf("unexpected exit record: %s", raw)
	}
}
