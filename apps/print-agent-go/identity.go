package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"time"
)

// stableIdentity preserves the bridge identity across re-pairings and config
// loss. Without it, a fresh pairing picks a brand-new instance id and the
// server creates a duplicate bridge row instead of reusing the machine's row.

type stableIdentity struct {
	BridgeID   string `json:"bridgeId,omitempty"`
	InstanceID string `json:"instanceId,omitempty"`
	UpdatedAt  string `json:"updatedAt,omitempty"`
}

func identityPath() string {
	return filepath.Join(filepath.Dir(configPath()), ".identity.json")
}

func loadIdentity() *stableIdentity {
	raw, err := os.ReadFile(identityPath())
	if err != nil {
		return nil
	}
	var identity stableIdentity
	if json.Unmarshal(raw, &identity) != nil {
		return nil
	}
	return &identity
}

func saveIdentity(bridgeID, instanceID string) {
	if bridgeID == "" && instanceID == "" {
		return
	}
	identity := stableIdentity{
		BridgeID:   bridgeID,
		InstanceID: instanceID,
		UpdatedAt:  time.Now().UTC().Format(time.RFC3339),
	}
	if raw, err := json.Marshal(identity); err == nil {
		_ = os.WriteFile(identityPath(), raw, 0o600)
	}
}
