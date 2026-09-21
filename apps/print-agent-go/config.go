package main

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"time"
)

// PrinterTarget is where a station/area ticket is physically sent. Type "tcp"
// prints raw ESC/POS directly to a network printer (ip:port, no driver/QZ);
// type "qz" (or empty, for legacy configs) prints through QZ Tray by name.
type PrinterTarget struct {
	Type string `json:"type,omitempty"`
	Name string `json:"name,omitempty"`
	IP   string `json:"ip,omitempty"`
	Port int    `json:"port,omitempty"`
}

// Config is persisted to disk after a successful pairing so the daemon can
// reconnect automatically on every boot without any user interaction.
type Config struct {
	APIBase            string                   `json:"apiBase"`
	BridgeID           string                   `json:"bridgeId"`
	InstanceID         string                   `json:"instanceId"`
	Code               string                   `json:"code"`
	QZPort             int                      `json:"qzPort,omitempty"`
	QZSecure           bool                     `json:"qzSecure,omitempty"`
	Areas              []string                 `json:"areas,omitempty"`
	PrinterNames       map[string]string        `json:"printerNames,omitempty"`
	PrinterTargets     map[string]PrinterTarget `json:"printerTargets,omitempty"`
	DiscoveredPrinters []string                 `json:"discoveredPrinters,omitempty"`
	// AutoUpdate enables the self-updater (default true when absent). It checks
	// the deploy origin's /downloads/version.json and applies a newer release.
	AutoUpdate *bool `json:"autoUpdate,omitempty"`
	// DashboardPort is the loopback port of the local diagnostics dashboard.
	// Default 8183; never bound on a public interface.
	DashboardPort int `json:"dashboardPort,omitempty"`
	// Certified fiscal printer (RT) reached over the cashier PC's LAN. This is
	// configured on the cashier PC itself (it owns the serial/USB or localhost
	// path to the device); the server only enqueues fiscal jobs.
	FiscalPrinter *FiscalPrinter `json:"fiscalPrinter,omitempty"`
}

// targetFor resolves the destination for an area. It prefers the richer
// PrinterTargets map and falls back to the legacy PrinterNames map, then to a
// "default" entry. Returns ok=false when nothing is configured.
func (c *Config) targetFor(area string) (PrinterTarget, bool) {
	if c == nil {
		return PrinterTarget{}, false
	}
	if target, ok := c.lookupTarget(area); ok {
		return target, true
	}
	return c.lookupTarget("default")
}

func (c *Config) lookupTarget(area string) (PrinterTarget, bool) {
	if target, ok := c.PrinterTargets[area]; ok {
		if target.IP != "" || target.Name != "" {
			if target.Type == "" {
				if target.IP != "" {
					target.Type = "tcp"
				} else {
					target.Type = "qz"
				}
			}
			return target, true
		}
	}
	if name, ok := c.PrinterNames[area]; ok && name != "" {
		return PrinterTarget{Type: "qz", Name: name}, true
	}
	return PrinterTarget{}, false
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
		return windowsConfigPath()
	}
	return filepath.Join("/etc/gustopos-print-agent", "config.json")
}

// windowsConfigPath preserves the legacy machine-wide location when a config
// already exists there. New user-session installs use LOCALAPPDATA, which is
// writable by the same standard user that runs QZ Tray and the ONLOGON task.
func windowsConfigPath() string {
	programData := os.Getenv("ProgramData")
	if programData == "" {
		programData = `C:\ProgramData`
	}
	legacy := filepath.Join(programData, "gustopos-print-agent", "config.json")
	if _, err := os.Stat(legacy); err == nil {
		return legacy
	}

	localAppData := os.Getenv("LOCALAPPDATA")
	if localAppData == "" {
		localAppData = filepath.Join(os.Getenv("USERPROFILE"), "AppData", "Local")
	}
	if localAppData == "" {
		return legacy
	}
	return filepath.Join(localAppData, "GustoPOS", "PrintAgent", "config.json")
}

func DefaultConfig() *Config {
	return &Config{
		QZPort:        8182,
		DashboardPort: dashboardDefaultPort,
		Areas:         []string{"kitchen", "bar", "cashier"},
		FiscalPrinter: &FiscalPrinter{Model: "generic-rt", Port: 4001, Timeout: 15 * time.Second},
	}
}

// LoadConfig reads the config file if present. Returns nil,nil when absent.
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

func (c *Config) IsPaired() bool {
	return c != nil && c.APIBase != "" && c.BridgeID != "" && c.InstanceID != "" && c.Code != ""
}

// autoUpdateEnabled reports whether the self-updater may run. Absent means on.
func (c *Config) autoUpdateEnabled() bool {
	return c != nil && (c.AutoUpdate == nil || *c.AutoUpdate)
}
