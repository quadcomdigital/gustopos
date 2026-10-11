package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"
)

func TestNextBackoff(t *testing.T) {
	if got := nextBackoff(time.Second); got != 2*time.Second {
		t.Fatalf("nextBackoff(1s) = %s", got)
	}
	if got := nextBackoff(45 * time.Second); got != maxBackoff {
		t.Fatalf("nextBackoff(45s) = %s, want %s", got, maxBackoff)
	}
}

func TestUpdateAttemptGuard(t *testing.T) {
	t.Setenv("GUSTOPOS_AGENT_CONFIG", filepath.Join(t.TempDir(), "config.json"))
	if shouldSkipUpdateAttempt("9.9.9") {
		t.Fatal("no attempt recorded yet, should not skip")
	}
	recordUpdateAttempt("9.9.9")
	if shouldSkipUpdateAttempt("9.9.9") {
		t.Fatal("one attempt should not skip")
	}
	recordUpdateAttempt("9.9.9")
	if !shouldSkipUpdateAttempt("9.9.9") {
		t.Fatal("two attempts within the window should skip")
	}
	if shouldSkipUpdateAttempt("9.9.10") {
		t.Fatal("a different version must not be skipped")
	}
}

func TestIsNewerVersion(t *testing.T) {
	cases := []struct {
		remote  string
		current string
		want    bool
	}{
		{"0.11.0", "0.10.0", true},
		{"v0.11.0", "0.10.9", true},
		{"0.10.0", "0.10.0", false},
		{"0.10.0", "0.11.0", false},
		{"1.0.0", "0.99.99", true},
		{"0.10.1-rc1", "0.10.0", true},
		{"garbage", "0.10.0", false},
	}
	for _, tc := range cases {
		if got := isNewerVersion(tc.remote, tc.current); got != tc.want {
			t.Errorf("isNewerVersion(%q, %q) = %v, want %v", tc.remote, tc.current, got, tc.want)
		}
	}
}

func TestParseVersion(t *testing.T) {
	got, ok := parseVersion("v1.2.3")
	if !ok || got != [3]int{1, 2, 3} {
		t.Fatalf("parseVersion = %v, %v", got, ok)
	}
	if _, ok := parseVersion(""); ok {
		t.Fatal("empty version should not parse")
	}
}

func TestFindArtifact(t *testing.T) {
	manifest := &UpdateManifest{Artifacts: []UpdateArtifact{{File: "a", SHA256: "x"}, {File: "b"}}}
	if artifact, ok := findArtifact(manifest, "b"); !ok || artifact.File != "b" {
		t.Fatalf("findArtifact b = %#v, %v", artifact, ok)
	}
	if _, ok := findArtifact(manifest, "c"); ok {
		t.Fatal("findArtifact c should be missing")
	}
}

func TestDownloadAndVerifyChecksum(t *testing.T) {
	dir := t.TempDir()
	var err error
	if err = os.WriteFile(filepath.Join(dir, "artifact"), []byte("hello"), 0o644); err != nil {
		t.Fatal(err)
	}
	sum, err := fileSHA256(filepath.Join(dir, "artifact"))
	if err != nil {
		t.Fatal(err)
	}
	// sha256("hello")
	if sum != "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824" {
		t.Fatalf("unexpected sha256: %s", sum)
	}
}

// ─── Release-regression coverage ───────────────────────────────────────────
// These pin the behaviour existing installations rely on when a new release is
// published: each agent must pick ITS OWN artifact (flavor vs flavorless),
// verify the checksum against the manifest, and never touch the running
// binary when the manifest is not strictly newer.

func TestArtifactNameMatchesPublishedNaming(t *testing.T) {
	saved := flavor
	defer func() { flavor = saved }()

	suffix := runtime.GOOS + "-" + runtime.GOARCH
	if runtime.GOOS == "windows" {
		suffix += ".exe"
	}

	flavor = ""
	if got, want := artifactName(), "gustopos-print-agent-"+suffix; got != want {
		t.Errorf("flavorless artifactName = %q, want %q", got, want)
	}

	flavor = "casale"
	if got, want := artifactName(), "gustopos-print-agent-casale-"+suffix; got != want {
		t.Errorf("flavored artifactName = %q, want %q", got, want)
	}
}

// updateServer serves a manifest + artifacts the way the deploy origin does.
func updateServer(t *testing.T, manifestVersion, artifactFile, sha string, payload []byte) *httptest.Server {
	t.Helper()
	mux := http.NewServeMux()
	mux.HandleFunc("/downloads/version.json", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(UpdateManifest{
			App:       "gustopos-print-agent",
			Version:   manifestVersion,
			Artifacts: []UpdateArtifact{{File: artifactFile, SHA256: sha, Size: int64(len(payload))}},
		})
	})
	mux.HandleFunc("/downloads/bin/"+artifactFile, func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write(payload)
	})
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return srv
}

func stagedPath(t *testing.T) string {
	t.Helper()
	exe, err := os.Executable()
	if err != nil {
		t.Fatalf("os.Executable: %v", err)
	}
	return filepath.Join(filepath.Dir(exe), ".gustopos-print-agent.update")
}

func TestStageUpdateIfAvailable(t *testing.T) {
	t.Setenv("GUSTOPOS_AGENT_CONFIG", filepath.Join(t.TempDir(), "config.json"))
	savedVersion := version
	version = "1.0.0"
	defer func() { version = savedVersion }()

	payload := []byte("pretend-agent-binary")
	sum := sha256.Sum256(payload)
	sha := hex.EncodeToString(sum[:])
	dest := stagedPath(t)
	defer os.Remove(dest)

	t.Run("stages the matching artifact when the manifest is newer", func(t *testing.T) {
		srv := updateServer(t, "9.9.9", artifactName(), sha, payload)
		staged, err := stageUpdateIfAvailable(srv.URL)
		if err != nil {
			t.Fatalf("stageUpdateIfAvailable: %v", err)
		}
		if staged == nil {
			t.Fatal("expected an update to be staged")
		}
		if staged.Version != "9.9.9" {
			t.Errorf("staged version = %q, want 9.9.9", staged.Version)
		}
		if staged.Path != dest {
			t.Errorf("staged path = %q, want %q", staged.Path, dest)
		}
		got, err := fileSHA256(staged.Path)
		if err != nil {
			t.Fatalf("hash staged file: %v", err)
		}
		if got != sha {
			t.Errorf("staged sha256 = %s, want %s", got, sha)
		}
	})

	t.Run("does nothing when the manifest equals the running version", func(t *testing.T) {
		srv := updateServer(t, "1.0.0", artifactName(), sha, payload)
		staged, err := stageUpdateIfAvailable(srv.URL)
		if err != nil {
			t.Fatalf("stageUpdateIfAvailable: %v", err)
		}
		if staged != nil {
			t.Fatalf("current version must not stage an update, got %#v", staged)
		}
	})

	t.Run("does nothing when the manifest is older", func(t *testing.T) {
		srv := updateServer(t, "0.9.0", artifactName(), sha, payload)
		staged, err := stageUpdateIfAvailable(srv.URL)
		if err != nil {
			t.Fatalf("stageUpdateIfAvailable: %v", err)
		}
		if staged != nil {
			t.Fatalf("older manifest must not stage an update, got %#v", staged)
		}
	})

	t.Run("does nothing when no artifact matches this OS/arch", func(t *testing.T) {
		srv := updateServer(t, "9.9.6", "gustopos-print-agent-plan9-mips", sha, payload)
		staged, err := stageUpdateIfAvailable(srv.URL)
		if err != nil {
			t.Fatalf("stageUpdateIfAvailable: %v", err)
		}
		if staged != nil {
			t.Fatalf("missing artifact must be a no-op, got %#v", staged)
		}
	})

	t.Run("rejects a checksum mismatch and leaves nothing behind", func(t *testing.T) {
		srv := updateServer(t, "9.9.7", artifactName(), "deadbeef", payload)
		_ = os.Remove(dest)
		if _, err := stageUpdateIfAvailable(srv.URL); err == nil {
			t.Fatal("checksum mismatch must fail")
		}
		if _, err := os.Stat(dest); !os.IsNotExist(err) {
			t.Fatalf("mismatched artifact must not be kept: %v", err)
		}
	})

	t.Run("rejects an unsafe artifact name", func(t *testing.T) {
		// The manifest must advertise exactly the name this build asks for, so
		// the traversal can only come from a poisoned flavor baked into the
		// binary: filepath.Base must refuse it before anything is downloaded.
		savedFlavor := flavor
		flavor = "../../evil"
		defer func() { flavor = savedFlavor }()

		srv := updateServer(t, "9.9.6", artifactName(), sha, payload)
		if _, err := stageUpdateIfAvailable(srv.URL); err == nil {
			t.Fatal("path traversal in the artifact name must fail")
		}
		if _, err := os.Stat(dest); !os.IsNotExist(err) {
			t.Fatalf("unsafe artifact must not be written: %v", err)
		}
	})
}
