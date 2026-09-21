package main

import (
	"os"
	"strings"
	"testing"
)

func TestRotatingLogWriterRotates(t *testing.T) {
	dir := t.TempDir()
	path := dir + "/agent.log"
	writer, err := newRotatingLogWriter(path)
	if err != nil {
		t.Fatalf("newRotatingLogWriter: %v", err)
	}
	defer writer.Close()

	chunk := strings.Repeat("x", 1024)
	for i := 0; i < (logMaxBytes/len(chunk))+2; i++ {
		if _, err := writer.Write([]byte(chunk)); err != nil {
			t.Fatalf("write: %v", err)
		}
	}
	if _, err := os.Stat(path + ".1"); err != nil {
		t.Fatalf("expected rotated file %s.1: %v", path, err)
	}
	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("expected active log: %v", err)
	}
	if info.Size() > logMaxBytes {
		t.Fatalf("active log grew past the limit: %d", info.Size())
	}
}
