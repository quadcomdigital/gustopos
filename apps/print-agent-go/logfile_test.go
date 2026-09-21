package main

import (
	"errors"
	"io"
	"os"
	"strings"
	"testing"
)

type failingWriter struct{}

func (failingWriter) Write([]byte) (int, error) { return 0, errors.New("boom") }

func TestBestEffortWriterKeepsWritingPastFailure(t *testing.T) {
	var buffer strings.Builder
	writer := bestEffortWriter{writers: []io.Writer{failingWriter{}, &buffer}}
	n, err := writer.Write([]byte("hello"))
	if err != nil {
		t.Fatalf("bestEffortWriter returned error: %v", err)
	}
	if n != len("hello") || buffer.String() != "hello" {
		t.Fatalf("later writer not reached: n=%d buffer=%q", n, buffer.String())
	}
}

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
