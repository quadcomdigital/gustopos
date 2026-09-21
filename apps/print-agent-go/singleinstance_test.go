//go:build linux || darwin

package main

import (
	"path/filepath"
	"testing"
)

func TestSingleInstanceLock(t *testing.T) {
	t.Setenv("GUSTOPOS_AGENT_CONFIG", filepath.Join(t.TempDir(), "config.json"))

	release, already, err := acquireSingleInstance()
	if err != nil {
		t.Fatalf("first acquire: %v", err)
	}
	if already {
		t.Fatal("first acquire must not report already running")
	}

	releaseSecond, alreadySecond, err := acquireSingleInstance()
	if err != nil {
		t.Fatalf("second acquire: %v", err)
	}
	if !alreadySecond {
		t.Fatal("second acquire must report already running")
	}
	releaseSecond()

	release()
	releaseThird, alreadyThird, err := acquireSingleInstance()
	if err != nil {
		t.Fatalf("third acquire: %v", err)
	}
	if alreadyThird {
		t.Fatal("lock must be free after release")
	}
	releaseThird()
}
