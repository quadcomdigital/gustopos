package main

import (
	"os"
	"path/filepath"
	"testing"
)

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
