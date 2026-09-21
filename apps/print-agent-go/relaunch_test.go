package main

import (
	"path/filepath"
	"testing"
)

func TestRelaunchGuard(t *testing.T) {
	t.Setenv("GUSTOPOS_AGENT_CONFIG", filepath.Join(t.TempDir(), "config.json"))
	if shouldBlockRelaunch() {
		t.Fatal("no attempts recorded yet")
	}
	for i := 0; i < maxRelaunchPerWindow; i++ {
		recordRelaunch()
	}
	if !shouldBlockRelaunch() {
		t.Fatal("expected guard to trip after max attempts")
	}
}
