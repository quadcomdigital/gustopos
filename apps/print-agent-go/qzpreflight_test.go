package main

// QZ Tray preflight tests.
//
// Every scenario here corresponds to something we actually hit on site: a
// missing override.crt, an anchor belonging to another tenant, a machine whose
// clock puts the certificate in the future, and the uppercase allowed.dat
// entries our own installers used to write (invisible to QZ, which matches the
// SHA-1 case-sensitively).

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"fmt"
	"math/big"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

type testPKI struct {
	certPEM     string
	rootPEM     string
	fingerprint string // uppercase SHA-1, as displayed
}

// newTestPKI mints a CA and a leaf with the requested validity window.
func newTestPKI(t *testing.T, notBefore, notAfter time.Time, commonName string) testPKI {
	t.Helper()

	caKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("ca key: %v", err)
	}
	caTemplate := &x509.Certificate{
		SerialNumber:          big.NewInt(1),
		Subject:               pkix.Name{CommonName: "GustoPOS test CA", Organization: []string{"GustoPOS"}},
		NotBefore:             time.Now().Add(-24 * time.Hour),
		NotAfter:              time.Now().Add(10 * 365 * 24 * time.Hour),
		IsCA:                  true,
		BasicConstraintsValid: true,
		KeyUsage:              x509.KeyUsageCertSign | x509.KeyUsageCRLSign | x509.KeyUsageDigitalSignature,
	}
	caDER, err := x509.CreateCertificate(rand.Reader, caTemplate, caTemplate, &caKey.PublicKey, caKey)
	if err != nil {
		t.Fatalf("ca cert: %v", err)
	}
	caCertificate, err := x509.ParseCertificate(caDER)
	if err != nil {
		t.Fatalf("parse ca: %v", err)
	}

	leafKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("leaf key: %v", err)
	}
	leafTemplate := &x509.Certificate{
		SerialNumber: big.NewInt(2),
		Subject:      pkix.Name{CommonName: commonName, Organization: []string{"GustoPOS"}},
		NotBefore:    notBefore,
		NotAfter:     notAfter,
		KeyUsage:     x509.KeyUsageDigitalSignature,
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth, x509.ExtKeyUsageServerAuth},
	}
	leafDER, err := x509.CreateCertificate(rand.Reader, leafTemplate, caCertificate, &leafKey.PublicKey, caKey)
	if err != nil {
		t.Fatalf("leaf cert: %v", err)
	}
	leafCertificate, err := x509.ParseCertificate(leafDER)
	if err != nil {
		t.Fatalf("parse leaf: %v", err)
	}

	return testPKI{
		certPEM:     string(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: leafDER})),
		rootPEM:     string(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: caDER})),
		fingerprint: sha1Fingerprint(leafCertificate),
	}
}

// validPKI is a healthy tenant: valid leaf, matching root.
func validPKI(t *testing.T) testPKI {
	t.Helper()
	return newTestPKI(t, time.Now().Add(-time.Hour), time.Now().Add(365*24*time.Hour), "GustoPOS test")
}

type fixture struct {
	dir          string
	installDir   string
	allowFile    string
	unusablePath string
	logFile      string
}

func newFixture(t *testing.T) *fixture {
	t.Helper()
	dir := t.TempDir()
	install := filepath.Join(dir, "qz")
	data := filepath.Join(dir, "data")
	for _, path := range []string{install, data} {
		if err := os.MkdirAll(path, 0o755); err != nil {
			t.Fatalf("mkdir %s: %v", path, err)
		}
	}
	// A path below a regular file: QZ cannot create the directory there, which
	// is how "no writable allowed.dat directory" is produced deterministically
	// (the tests must not depend on running as root or not).
	blocker := filepath.Join(dir, "not-a-dir")
	if err := os.WriteFile(blocker, []byte("x"), 0o644); err != nil {
		t.Fatalf("write blocker: %v", err)
	}
	return &fixture{
		dir:          dir,
		installDir:   install,
		allowFile:    filepath.Join(data, "allowed.dat"),
		unusablePath: filepath.Join(blocker, "allowed.dat"),
		logFile:      filepath.Join(dir, "debug.log"),
	}
}

func (f *fixture) installAnchor(t *testing.T, rootPEM string) string {
	t.Helper()
	path := filepath.Join(f.installDir, "override.crt")
	if err := os.WriteFile(path, []byte(rootPEM), 0o644); err != nil {
		t.Fatalf("write override.crt: %v", err)
	}
	return path
}

func (f *fixture) writeAllow(t *testing.T, fingerprint string) {
	t.Helper()
	line := fmt.Sprintf("%s\tGustoPOS test\tGustoPOS\t2026-01-01 00:00:00\t2030-01-01 00:00:00\tTrue\n", fingerprint)
	if err := os.WriteFile(f.allowFile, []byte(line), 0o644); err != nil {
		t.Fatalf("write allowed.dat: %v", err)
	}
}

func (f *fixture) writeLog(t *testing.T, line string) {
	t.Helper()
	if err := os.WriteFile(f.logFile, []byte("2026-09-24 10:00:00 main : "+line+"\n"), 0o644); err != nil {
		t.Fatalf("write debug.log: %v", err)
	}
}

func (f *fixture) preflight(certPEM, rootPEM string) Preflight {
	return Preflight{
		CertPEM:       certPEM,
		RootPEM:       rootPEM,
		Now:           time.Now(),
		InstallDirs:   []string{f.installDir},
		AllowPaths:    []string{f.allowFile},
		DebugLogPaths: []string{f.logFile},
	}
}

func checkNamed(t *testing.T, report PreflightReport, name string) PreflightCheck {
	t.Helper()
	for _, check := range report.Checks {
		if check.Name == name {
			return check
		}
	}
	t.Fatalf("check %q missing from report: %+v", name, report.Checks)
	return PreflightCheck{}
}

func TestPreflightHealthyInstallation(t *testing.T) {
	fixture := newFixture(t)
	pki := validPKI(t)
	fixture.installAnchor(t, pki.rootPEM)
	fixture.writeAllow(t, strings.ToLower(pki.fingerprint))
	fixture.writeLog(t, "Successfully chained certificate: CN=GustoPOS test, O=GustoPOS")

	preflight := fixture.preflight(pki.certPEM, pki.rootPEM)
	preflight.AutoHeal = false
	report := preflight.Run()

	if !report.OK {
		t.Fatalf("expected a healthy report, got blocking=%q checks=%+v", report.Blocking, report.Checks)
	}
	if report.Fingerprint != pki.fingerprint {
		t.Fatalf("fingerprint = %q, want %q", report.Fingerprint, pki.fingerprint)
	}
	if report.CertPEM != pki.certPEM {
		t.Fatal("report must carry the certificate it validated so the connection presents exactly that one")
	}
	if report.Whitelisted != fixture.allowFile {
		t.Fatalf("whitelistedIn = %q, want %q", report.Whitelisted, fixture.allowFile)
	}
	if log := checkNamed(t, report, checkLog); !strings.Contains(log.Detail, "Successfully chained") {
		t.Fatalf("log check should surface QZ's own verdict, got %q", log.Detail)
	}
}

func TestPreflightMissingOverrideCrt(t *testing.T) {
	fixture := newFixture(t)
	pki := validPKI(t)

	report := fixture.preflight(pki.certPEM, pki.rootPEM).Run()

	if report.OK {
		t.Fatal("a machine without override.crt must not pass: QZ would show the dialog")
	}
	anchor := checkNamed(t, report, checkAnchor)
	if anchor.OK {
		t.Fatal("override.crt check should fail")
	}
	if !strings.Contains(anchor.Detail, "not found") {
		t.Fatalf("detail should say the anchor is missing, got %q", anchor.Detail)
	}
	if !strings.Contains(anchor.Fix, "installer") {
		t.Fatalf("fix should point at the installer, got %q", anchor.Fix)
	}
	if chain := checkNamed(t, report, checkChain); chain.OK {
		t.Fatal("chain cannot be verified without an anchor")
	}
}

func TestPreflightAnchorFromAnotherTenant(t *testing.T) {
	fixture := newFixture(t)
	pki := validPKI(t)
	other := validPKI(t) // different root
	fixture.installAnchor(t, other.rootPEM)

	report := fixture.preflight(pki.certPEM, pki.rootPEM).Run()

	if report.OK {
		t.Fatal("a stale/foreign anchor must fail: it is exactly what breaks a second tenant")
	}
	anchor := checkNamed(t, report, checkAnchor)
	if anchor.OK {
		t.Fatal("anchor mismatch should fail")
	}
	if !strings.Contains(anchor.Detail, "another tenant's anchor") {
		t.Fatalf("detail should name the mismatch, got %q", anchor.Detail)
	}
	if !strings.Contains(anchor.Fix, "THIS tenant") {
		t.Fatalf("fix should tell the operator to re-run the right installer, got %q", anchor.Fix)
	}
}

func TestPreflightCertificateNotYetValid(t *testing.T) {
	fixture := newFixture(t)
	pki := newTestPKI(t, time.Now().Add(time.Hour), time.Now().Add(48*time.Hour), "GustoPOS test")
	fixture.installAnchor(t, pki.rootPEM)

	report := fixture.preflight(pki.certPEM, pki.rootPEM).Run()

	if report.OK {
		t.Fatal("a certificate whose notBefore is in the future must fail (QZ: Future Certificate)")
	}
	validity := checkNamed(t, report, checkValidity)
	if validity.OK {
		t.Fatal("validity check should fail")
	}
	if !strings.Contains(validity.Detail, "clock") {
		t.Fatalf("detail should blame the clock, got %q", validity.Detail)
	}
}

func TestPreflightCertificateExpired(t *testing.T) {
	fixture := newFixture(t)
	pki := newTestPKI(t, time.Now().Add(-48*time.Hour), time.Now().Add(-time.Hour), "GustoPOS test")
	fixture.installAnchor(t, pki.rootPEM)

	report := fixture.preflight(pki.certPEM, pki.rootPEM).Run()

	if report.OK {
		t.Fatal("an expired certificate must fail (QZ: Expired Certificate)")
	}
	validity := checkNamed(t, report, checkValidity)
	if validity.OK || !strings.Contains(validity.Detail, "expired") {
		t.Fatalf("validity check should report the expiry, got ok=%v detail=%q", validity.OK, validity.Detail)
	}
}

func TestPreflightBlankCommonName(t *testing.T) {
	fixture := newFixture(t)
	pki := newTestPKI(t, time.Now().Add(-time.Hour), time.Now().Add(24*time.Hour), "")
	fixture.installAnchor(t, pki.rootPEM)

	report := fixture.preflight(pki.certPEM, pki.rootPEM).Run()

	if report.OK {
		t.Fatal("QZ rejects a certificate with a blank CN outright")
	}
	certificate := checkNamed(t, report, checkCertificate)
	if !strings.Contains(certificate.Detail, "Common Name") {
		t.Fatalf("detail should mention the blank CN, got %q", certificate.Detail)
	}
}

// The uppercase entries every previous installer wrote are in the file but QZ
// never sees them (String.equals against a lowercase SHA-1) — reporting them
// as "present" would hide the very reason the dialog keeps coming back.
func TestPreflightUppercaseAllowedEntryIsNotAccepted(t *testing.T) {
	fixture := newFixture(t)
	pki := validPKI(t)
	fixture.installAnchor(t, pki.rootPEM)
	fixture.writeAllow(t, pki.fingerprint) // UPPERCASE, as openssl/.NET print it

	preflight := fixture.preflight(pki.certPEM, pki.rootPEM)
	preflight.AutoHeal = false
	report := preflight.Run()

	if report.OK {
		t.Fatal("an UPPERCASE allowed.dat entry must fail: QZ matches case-sensitively")
	}
	whitelist := checkNamed(t, report, checkWhitelist)
	if whitelist.OK {
		t.Fatal("whitelist check should fail")
	}
	if !strings.Contains(whitelist.Detail, "UPPERCASE") {
		t.Fatalf("detail should explain the case problem, got %q", whitelist.Detail)
	}
	if !strings.Contains(whitelist.Fix, "installer") {
		t.Fatalf("fix should point at the installer, got %q", whitelist.Fix)
	}
}

func TestPreflightValidChainRecordsOnFirstConnect(t *testing.T) {
	fixture := newFixture(t)
	pki := validPKI(t)
	fixture.installAnchor(t, pki.rootPEM) // no allowed.dat at all

	preflight := fixture.preflight(pki.certPEM, pki.rootPEM)
	preflight.AutoHeal = false
	report := preflight.Run()

	if !report.OK {
		t.Fatalf("a valid chain plus a writable data dir is enough for QZ: blocking=%q", report.Blocking)
	}
	if whitelist := checkNamed(t, report, checkWhitelist); !whitelist.OK || !strings.Contains(whitelist.Detail, "first connect") {
		t.Fatalf("whitelist check should explain the auto-record, got ok=%v detail=%q", whitelist.OK, whitelist.Detail)
	}
}

func TestPreflightUnwritableAllowedDatBlocks(t *testing.T) {
	fixture := newFixture(t)
	pki := validPKI(t)
	fixture.installAnchor(t, pki.rootPEM)

	preflight := fixture.preflight(pki.certPEM, pki.rootPEM)
	preflight.AllowPaths = []string{fixture.unusablePath} // directory cannot be created
	preflight.AutoHeal = false
	report := preflight.Run()

	if report.OK {
		t.Fatal("when QZ cannot remember the approval it prompts forever — must block")
	}
	if writable := checkNamed(t, report, checkWritable); writable.OK {
		t.Fatal("writable check should fail")
	}
}

// Auto-heal: chain valid, fingerprint missing → run QZ's own `--allow`, which
// is exactly what "Remember this decision" writes. A stub QZ binary proves the
// flow (invoke → re-scan → report) without needing QZ Tray installed.
func TestPreflightAutoHealWhitelists(t *testing.T) {
	fixture := newFixture(t)
	pki := validPKI(t)
	fixture.installAnchor(t, pki.rootPEM)

	lower := strings.ToLower(pki.fingerprint)
	script := fmt.Sprintf(
		"#!/bin/sh\nprintf '%%s\\tGustoPOS test\\tGustoPOS\\t2026-01-01 00:00:00\\t2030-01-01 00:00:00\\tTrue\\n' '%s' >> '%s'\n",
		lower, fixture.allowFile,
	)
	binary := filepath.Join(fixture.installDir, "qz-tray")
	if err := os.WriteFile(binary, []byte(script), 0o755); err != nil {
		t.Fatalf("write stub qz-tray: %v", err)
	}

	preflight := fixture.preflight(pki.certPEM, pki.rootPEM)
	preflight.AutoHeal = true
	report := preflight.Run()

	if !report.OK {
		t.Fatalf("auto-heal should have recorded the fingerprint: blocking=%q healed=%q",
			report.Blocking, report.Healed)
	}
	if !strings.Contains(report.Healed, "qz-tray") {
		t.Fatalf("healed should name the binary used, got %q", report.Healed)
	}
	if report.Whitelisted != fixture.allowFile {
		t.Fatalf("whitelistedIn = %q, want %q", report.Whitelisted, fixture.allowFile)
	}
}

func TestFindFingerprintDistinguishesCase(t *testing.T) {
	path := filepath.Join(t.TempDir(), "allowed.dat")
	fingerprint := "ABCDEF0123456789ABCDEF0123456789ABCDEF01"
	line := "\tCN\tO\t2026-01-01 00:00:00\t2030-01-01 00:00:00\tTrue\n"

	// lowercase — the form QZ writes and matches
	if err := os.WriteFile(path, []byte(strings.ToLower(fingerprint)+line), 0o644); err != nil {
		t.Fatal(err)
	}
	_, exact, folded := findFingerprint([]string{path}, fingerprint)
	if !exact || !folded {
		t.Fatalf("lowercase entry must be exact (exact=%v folded=%v)", exact, folded)
	}

	// uppercase — written by our old installers, invisible to QZ
	if err := os.WriteFile(path, []byte(fingerprint+line), 0o644); err != nil {
		t.Fatal(err)
	}
	_, exact, folded = findFingerprint([]string{path}, fingerprint)
	if exact {
		t.Fatal("an UPPERCASE entry must not count as exact: QZ matches case-sensitively")
	}
	if !folded {
		t.Fatal("the entry should still be reported as present so the fix can be named")
	}
}
