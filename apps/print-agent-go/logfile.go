package main

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
)

// Persistent rotating log file. On Windows the agent runs with the GUI
// subsystem (no console), so without a file an error after a restart would be
// invisible. Kept small (2 MiB × 3) so it never grows unbounded.

const (
	logFileName = "agent.log"
	logMaxBytes = 2 << 20 // 2 MiB
	logMaxFiles = 3
)

type rotatingLogWriter struct {
	mu   sync.Mutex
	path string
	file *os.File
	size int64
}

func newRotatingLogWriter(path string) (*rotatingLogWriter, error) {
	w := &rotatingLogWriter{path: path}
	if err := w.open(); err != nil {
		return nil, err
	}
	return w, nil
}

// logFilePath returns the log location next to the config file, so it follows
// the same per-user/per-OS resolution (LOCALAPPDATA on Windows, /etc on Linux).
func logFilePath() string {
	return filepath.Join(filepath.Dir(configPath()), logFileName)
}

func (w *rotatingLogWriter) open() error {
	file, err := os.OpenFile(w.path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o600)
	if err != nil {
		return err
	}
	w.file = file
	if info, err := file.Stat(); err == nil {
		w.size = info.Size()
	}
	return nil
}

func (w *rotatingLogWriter) Write(p []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.file == nil {
		return 0, os.ErrClosed
	}
	if w.size+int64(len(p)) > logMaxBytes {
		w.rotate()
	}
	n, err := w.file.Write(p)
	w.size += int64(n)
	return n, err
}

func (w *rotatingLogWriter) rotate() {
	if w.file != nil {
		_ = w.file.Close()
		w.file = nil
	}
	// agent.log.2 is dropped, .1→.2, agent.log→.1.
	for i := logMaxFiles - 1; i >= 1; i-- {
		_ = os.Rename(fmt.Sprintf("%s.%d", w.path, i), fmt.Sprintf("%s.%d", w.path, i+1))
	}
	_ = os.Rename(w.path, w.path+".1")
	_ = w.open()
}

func (w *rotatingLogWriter) Close() error {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.file == nil {
		return nil
	}
	err := w.file.Close()
	w.file = nil
	return err
}

// bestEffortWriter writes to every target even if an earlier one fails. On the
// console-less Windows build os.Stderr can be an invalid handle; the standard
// io.MultiWriter stops at the first error, which would leave the ring buffer and
// the log file empty (and diagnostics would ship zero logs).
type bestEffortWriter struct {
	writers []io.Writer
}

func (w bestEffortWriter) Write(p []byte) (int, error) {
	var lastErr error
	written := 0
	for _, target := range w.writers {
		n, err := target.Write(p)
		if err != nil {
			lastErr = err
			continue
		}
		if n > written {
			written = n
		}
	}
	if written == 0 && lastErr != nil {
		return 0, lastErr
	}
	return written, nil
}
