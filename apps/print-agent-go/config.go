package main

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"runtime"
)

// Config is persisted to disk after a successful pairing so the daemon can
// reconnect automatically on every boot without any user interaction.
type Config struct {
	// APIBase is the origin of the GustoPOS API, e.g. "https://pos.example.com".
	APIBase string `json:"apiBase"`
	// BridgeID is this machine's unique bridge identifier (stable across restarts).
	BridgeID string `json:"bridgeId"`
	// InstanceID is a stable per-machine UUID used for claim ownership
	// (X-Bridge-Instance-Id). It must survive restarts, otherwise the API
	// refuses to complete jobs we claimed earlier.
	InstanceID string `json:"instanceId"`
	// Code is the 6-digit pairing code. Once bound to this bridge server-side
	// it becomes a permanent credential (revoking the secret detaches us).
	Code string `json:"code"`
	// QZPort is the QZ Tray local WebSocket port (8181 secure, 8182 insecure).
	QZPort int `json:"qzPort,omitempty"`
	// QZSecure toggles wss:// vs ws:// for the local QZ Tray connection.
	QZSecure bool `json:"qzSecure,omitempty"`
	// Areas this machine prints for.
	Areas []string `json:"areas,omitempty"`
	// PrinterNames maps area -> QZ printer name. Optional: if empty the agent
	// asks QZ Tray to print to the default printer.
	PrinterNames map[string]string `json:"printerNames,omitempty"`
}

// configPath returns the location of the persistent config file.
func configPath() string {
	if p := os.Getenv("GUSTOPOS_AGENT_CONFIG"); p != "" {
		return p
	}
	if h := os.Getenv("GUSTOPOS_AGENT_HOME"); h != "" {
		return filepath.Join(h, "config.json")
	}
	if runtime.GOOS == "windows" {
		// README documents C:\ProgramData\gustopos-print-agent\config.json
		if pd := os.Getenv("ProgramData"); pd != "" {
			return filepath.Join(pd, "gustopos-print-agent", "config.json")
		}
		return filepath.Join("C:\\ProgramData", "gustopos-print-agent", "config.json")
	}
	return filepath.Join("/etc/gustopos-print-agent", "config.json")
}

// DefaultConfig returns sensible defaults before any file is read.
func DefaultConfig() *Config {
	return &Config{
		QZPort: 8182, // QZ Tray insecure WS port (8181 is the secure WSS port)
		Areas:  []string{"kitchen", "bar", "cashier"},
	}
}

// LoadConfig reads the config file if present. Returns an error if the file
// exists but is malformed; returns (nil, nil) if the file does not exist yet.
func LoadConfig() (*Config, error) {
	path := configPath()
	raw, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, nil
		}
		return nil, err
	}
	cfg := DefaultConfig()
	if err := json.Unmarshal(raw, cfg); err != nil {
		return nil, err
	}
	// A hand-written config with `"areas": null` would marshal back to JSON
	// `null` and be rejected by the API's heartbeat schema. Normalize to the
	// defaults so the agent always sends a valid array.
	if len(cfg.Areas) == 0 {
		cfg.Areas = DefaultConfig().Areas
	}
	return cfg, nil
}

// Save writes the config atomically (tmp file + rename) with 0600 perms.
func (c *Config) Save() error {
	path := configPath()
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	raw, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, raw, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

// IsPaired reports whether we have enough state to start the agent loop.
func (c *Config) IsPaired() bool {
	return c != nil && c.APIBase != "" && c.BridgeID != "" && c.InstanceID != "" && c.Code != ""
}
