package main

// QZ Tray preflight.
//
// QZ Tray never tells the client *why* it refuses: when the certificate does
// not chain to a CA it loaded from <install dir>/override.crt, or is outside
// its validity window, or cannot be recorded in allowed.dat, it simply opens
// the access dialog ("Untrusted website" / "Invalid Certificate") and the Go
// agent's handshake times out after 15s with a useless
// "did not acknowledge certificate within 15s (first-time allow dialog?)".
//
// Everything needed to explain the failure is on the local machine, so the
// agent checks it BEFORE dialling and reports a specific, actionable error
// (surfaced by the dashboard, the diagnostics feed and the connection error).
//
// QZ's own rules (qz/auth/Certificate.java, qz/utils/FileUtilities.java):
//   * the certificate must chain (PKIX) to a CA loaded once at startup from
//     override.crt next to the QZ jar — a root that is missing, stale (another
//     tenant's) or loaded before a restart shows as an untrusted certificate;
//   * notBefore/notAfter are checked twice (PKIX + explicit) →
//     "Future Certificate" / "Expired Certificate";
//   * the CN must not be blank ("Common Name cannot be blank.");
//   * allowed.dat is matched case-SENSITIVELY against a lowercase SHA-1
//     (ByteUtilities.toHexString(digest, upperCase=false));
//   * when the chain validates, QZ appends the fingerprint to allowed.dat
//     itself — so if that directory is not writable the decision cannot be
//     remembered and every connection prompts again.

import (
	"crypto/sha1"
	"crypto/x509"
	"encoding/hex"
	"encoding/pem"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"time"
)

// Check names — stable identifiers for the dashboard and the diagnostics feed.
const (
	checkCertificate = "certificate"
	checkValidity    = "validity"
	checkAnchor      = "override.crt"
	checkChain       = "chain"
	checkWhitelist   = "allowed.dat"
	checkWritable    = "allowed.dat writable"
	checkLog         = "qz debug.log"
)

// PreflightCheck is one local fact about the QZ installation.
type PreflightCheck struct {
	Name string `json:"name"`
	// OK is the state of this fact; Blocking tells whether a false OK blocks
	// the connection (some checks are informational).
	OK       bool   `json:"ok"`
	Blocking bool   `json:"blocking"`
	Detail   string `json:"detail"`
	Fix      string `json:"fix,omitempty"`
}

// PreflightReport is the JSON shape served by /api/qz/preflight and shipped to
// the server's diagnostics (Settings → Stampa).
type PreflightReport struct {
	OK        bool      `json:"ok"`
	CheckedAt time.Time `json:"checkedAt"`
	Blocking  string    `json:"blocking,omitempty"`
	// CertPEM is the certificate that was validated (public material, never
	// serialised): ensureQZ presents exactly what the preflight approved.
	CertPEM     string           `json:"-"`
	Fingerprint string           `json:"fingerprint,omitempty"` // SHA-1, uppercase, display only
	Subject     string           `json:"subject,omitempty"`
	AnchorPath  string           `json:"anchorPath,omitempty"`
	AnchorSHA1  string           `json:"anchorSha1,omitempty"`
	Whitelisted string           `json:"whitelistedIn,omitempty"`
	Healed      string           `json:"healed,omitempty"`
	Checks      []PreflightCheck `json:"checks"`
}

// Preflight performs the checks against a set of paths that a test can replace.
type Preflight struct {
	// CertPEM is the certificate the server publishes for this tenant (the one
	// the agent would present to QZ Tray).
	CertPEM string
	// RootPEM is /signing/override.crt from the same origin. Optional: when it
	// cannot be fetched the installed anchor is still checked on its own.
	RootPEM string

	Now time.Time

	// InstallDirs are the directories QZ Tray scans for override.crt.
	InstallDirs []string
	// AllowPaths are the allowed.dat files QZ Tray reads (user + shared + SYSTEM).
	AllowPaths []string
	// DebugLogPaths are QZ's debug.log candidates (informational only).
	DebugLogPaths []string

	// AutoHeal runs QZ's own `--allow` when the chain is valid but the
	// fingerprint is not recorded yet — the same thing clicking "Remember this
	// decision" does, without a human on the POS machine.
	AutoHeal bool
}

func parseCertificate(certificatePEM string) (*x509.Certificate, error) {
	data := []byte(certificatePEM)
	for {
		var block *pem.Block
		block, data = pem.Decode(data)
		if block == nil {
			return nil, fmt.Errorf("no PEM certificate found")
		}
		if block.Type != "CERTIFICATE" {
			continue
		}
		certificate, err := x509.ParseCertificate(block.Bytes)
		if err != nil {
			return nil, fmt.Errorf("parse certificate: %w", err)
		}
		return certificate, nil
	}
}

// sha1Fingerprint is QZ's thumbprint: uppercase hex without separators, for
// display. Matching against allowed.dat is always case-insensitive because QZ
// itself writes lowercase while openssl/.NET print uppercase.
func sha1Fingerprint(certificate *x509.Certificate) string {
	sum := sha1.Sum(certificate.Raw)
	return strings.ToUpper(hex.EncodeToString(sum[:]))
}

// Default QZ install directories per OS — the same ones the installers use.
func qzInstallDirs() []string {
	switch runtime.GOOS {
	case "windows":
		var dirs []string
		if programFiles := os.Getenv("ProgramFiles"); programFiles != "" {
			dirs = append(dirs, filepath.Join(programFiles, "QZ Tray"))
		}
		if programFilesX86 := os.Getenv("ProgramFiles(x86)"); programFilesX86 != "" {
			dirs = append(dirs, filepath.Join(programFilesX86, "QZ Tray"))
		}
		return dirs
	case "darwin":
		return []string{
			"/Applications/QZ Tray.app/Contents/Resources",
			"/Applications/QZ Tray.app/Contents/MacOS",
		}
	default:
		return []string{"/opt/qz-tray"}
	}
}

// allowed.dat locations (FileUtilities.USER_DIR / SHARED_DIR + the Windows
// service profile): QZ reads all of them and writes the first one it can.
func qzAllowPaths() []string {
	home, _ := os.UserHomeDir()
	switch runtime.GOOS {
	case "windows":
		var paths []string
		if appData := os.Getenv("APPDATA"); appData != "" {
			paths = append(paths, filepath.Join(appData, "qz", "allowed.dat"))
		}
		if programData := os.Getenv("PROGRAMDATA"); programData != "" {
			paths = append(paths, filepath.Join(programData, "qz", "allowed.dat"))
		}
		if windowsDir := os.Getenv("WINDIR"); windowsDir != "" {
			paths = append(paths, filepath.Join(windowsDir, "System32", "config", "systemprofile", "AppData", "Roaming", "qz", "allowed.dat"))
		}
		return paths
	case "darwin":
		return []string{
			filepath.Join(home, "Library", "Application Support", "qz", "allowed.dat"),
			"/Library/Application Support/qz/allowed.dat",
		}
	default:
		return []string{
			filepath.Join(home, ".qz", "allowed.dat"),
			"/srv/qz/allowed.dat",
		}
	}
}

func qzDebugLogPaths() []string {
	home, _ := os.UserHomeDir()
	switch runtime.GOOS {
	case "windows":
		var paths []string
		if appData := os.Getenv("APPDATA"); appData != "" {
			paths = append(paths, filepath.Join(appData, "qz", "debug.log"))
		}
		if programData := os.Getenv("PROGRAMDATA"); programData != "" {
			paths = append(paths, filepath.Join(programData, "qz", "debug.log"))
		}
		return paths
	case "darwin":
		return []string{filepath.Join(home, "Library", "Application Support", "qz", "debug.log")}
	default:
		return []string{filepath.Join(home, ".qz", "debug.log")}
	}
}

// newPreflight builds a preflight with the default, OS-appropriate paths.
func newPreflight(certPEM, rootPEM string) Preflight {
	return Preflight{
		CertPEM:       certPEM,
		RootPEM:       rootPEM,
		Now:           time.Now(),
		InstallDirs:   qzInstallDirs(),
		AllowPaths:    qzAllowPaths(),
		DebugLogPaths: qzDebugLogPaths(),
		AutoHeal:      true,
	}
}

// findInstalledAnchor returns the override.crt QZ would actually load, i.e. the
// first existing one (QZ scans its jar parent directory only).
func findInstalledAnchor(installDirs []string) (string, []byte, error) {
	var firstMissing []string
	for _, dir := range installDirs {
		path := filepath.Join(dir, "override.crt")
		content, err := os.ReadFile(path)
		if err == nil {
			return path, content, nil
		}
		firstMissing = append(firstMissing, path)
	}
	if len(firstMissing) == 0 {
		return "", nil, fmt.Errorf("no QZ Tray installation directory known")
	}
	return "", nil, fmt.Errorf("override.crt not found (looked in %s)", strings.Join(firstMissing, ", "))
}

// findFingerprint scans every allowed.dat for the leaf fingerprint.
//
// QZ matches the first tab-separated field with String.equals against a
// lowercase SHA-1, so "exact" is the only state QZ accepts. An entry written
// in uppercase (openssl/.NET print uppercase — every script did it before) is
// found case-insensitively but is invisible to QZ: report both, so the fix can
// be "re-run the installer" instead of a dialog nobody can explain.
func findFingerprint(allowPaths []string, fingerprint string) (path string, exact bool, folded bool) {
	lower := strings.ToLower(fingerprint)
	for _, candidate := range allowPaths {
		content, err := os.ReadFile(candidate)
		if err != nil {
			continue
		}
		for _, line := range strings.Split(string(content), "\n") {
			field := line
			if index := strings.IndexAny(line, "\t "); index >= 0 {
				field = line[:index]
			}
			field = strings.TrimSpace(field)
			if field == "" {
				continue
			}
			if field == lower {
				return candidate, true, true
			}
			if strings.EqualFold(field, fingerprint) {
				path, folded = candidate, true
			}
		}
	}
	return path, false, folded
}

// firstWritableDir reports the first allowed.dat directory this process can
// write to — the one QZ Tray itself would use to remember an approval.
func firstWritableDir(allowPaths []string) string {
	for _, path := range allowPaths {
		dir := filepath.Dir(path)
		if info, err := os.Stat(dir); err != nil || !info.IsDir() {
			// QZ creates the directory itself; try creating it here too so a
			// fresh machine is not reported as broken.
			if err := os.MkdirAll(dir, 0o755); err != nil {
				continue
			}
		}
		probe := filepath.Join(dir, ".gustopos-write-probe")
		if err := os.WriteFile(probe, []byte("probe"), 0o644); err != nil {
			continue
		}
		_ = os.Remove(probe)
		return dir
	}
	return ""
}

// lastTrustLogLine returns QZ's own verdict for the last connection, if it
// logged one — the fastest way to confirm a diagnosis on site.
func lastTrustLogLine(logPaths []string) string {
	for _, path := range logPaths {
		content, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		lines := strings.Split(string(content), "\n")
		for i := len(lines) - 1; i >= 0; i-- {
			line := strings.TrimSpace(lines[i])
			if line == "" {
				continue
			}
			if qzTrustLogPattern.MatchString(line) {
				if len(line) > 300 {
					line = line[:300] + "…"
				}
				return line
			}
		}
	}
	return ""
}

// qzTrustLogPattern matches the trust decisions QZ writes to debug.log
// (qz/auth/Certificate.java).
var qzTrustLogPattern = regexp.MustCompile(
	`Adding CA certificate|Successfully chained certificate|` +
		`Problem building certificate chain|Certificate is expired|` +
		`Cannot write to file allowed|Adding .+ to allowed list`)

// qzBinary returns the QZ Tray binary used to whitelist a certificate
// (`--allow` is an alias of `--whitelist` on every platform).
func qzBinary(installDirs []string) (string, error) {
	var candidates []string
	switch runtime.GOOS {
	case "windows":
		for _, dir := range installDirs {
			candidates = append(candidates, filepath.Join(dir, "qz-tray-console.exe"))
		}
	case "darwin":
		candidates = append(candidates, "/Applications/QZ Tray.app/Contents/MacOS/QZ Tray")
	default:
		for _, dir := range installDirs {
			candidates = append(candidates, filepath.Join(dir, "qz-tray"))
		}
	}
	for _, candidate := range candidates {
		if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
			return candidate, nil
		}
	}
	if found, err := exec.LookPath("qz-tray"); err == nil {
		return found, nil
	}
	return "", fmt.Errorf("QZ Tray binary not found")
}

// whitelistCertificate asks QZ Tray itself to record the fingerprint, which is
// exactly what "Remember this decision" writes (FileUtilities.addToCertList).
func whitelistCertificate(binary string, certPEM string) (string, error) {
	file, err := os.CreateTemp("", "gustopos-*.pem")
	if err != nil {
		return "", fmt.Errorf("temporary file: %w", err)
	}
	defer os.Remove(file.Name())
	if _, err := file.WriteString(certPEM); err != nil {
		file.Close()
		return "", err
	}
	file.Close()

	output, err := exec.Command(binary, "--allow", file.Name()).CombinedOutput()
	trimmed := strings.TrimSpace(string(output))
	if err != nil {
		return trimmed, fmt.Errorf("%s --allow: %w", filepath.Base(binary), err)
	}
	return trimmed, nil
}

// Run executes every check. It never panics and never returns an error: the
// report itself carries the outcome, so callers can always publish it.
func (p Preflight) Run() PreflightReport {
	now := p.Now
	if now.IsZero() {
		now = time.Now()
	}
	report := PreflightReport{CheckedAt: now, CertPEM: p.CertPEM, Checks: []PreflightCheck{}}

	add := func(name string, ok, blocking bool, detail, fix string) {
		report.Checks = append(report.Checks, PreflightCheck{
			Name: name, OK: ok, Blocking: blocking, Detail: detail, Fix: fix,
		})
		if !ok && blocking && report.Blocking == "" {
			report.Blocking = detail
		}
	}

	// ── 1. the certificate we would present ────────────────────────────────
	if strings.TrimSpace(p.CertPEM) == "" {
		add(checkCertificate, false, true, "no signing certificate was provided by the server",
			"check the server's /signing/digital-certificate.txt")
		return report
	}
	leaf, err := parseCertificate(p.CertPEM)
	if err != nil {
		add(checkCertificate, false, true, "certificate cannot be parsed: "+err.Error(),
			"the server is not serving a PEM certificate")
		return report
	}
	report.Fingerprint = sha1Fingerprint(leaf)
	report.Subject = leaf.Subject.String()
	if strings.TrimSpace(leaf.Subject.CommonName) == "" {
		add(checkCertificate, false, true, "the certificate has no Common Name (QZ Tray rejects it)",
			"re-issue it: gen-tenant-pki.sh <slug> --domains <hosts>")
		return report
	}
	add(checkCertificate, true, true, fmt.Sprintf("%s  SHA1 %s", leaf.Subject.CommonName, report.Fingerprint), "")

	// ── 2. validity window (system clock) ──────────────────────────────────
	switch {
	case now.Before(leaf.NotBefore):
		add(checkValidity, false, true,
			fmt.Sprintf("certificate is not valid until %s — this machine's clock is behind",
				leaf.NotBefore.UTC().Format(time.RFC3339)),
			"fix the system clock / enable NTP, then restart QZ Tray")
	case now.After(leaf.NotAfter):
		add(checkValidity, false, true,
			"certificate expired on "+leaf.NotAfter.UTC().Format(time.RFC3339),
			"rotate it: gen-tenant-pki.sh <slug> --rotate")
	default:
		add(checkValidity, true, true,
			fmt.Sprintf("valid %s → %s (clock skew tolerated: 15 min for signatures)",
				leaf.NotBefore.UTC().Format("2006-01-02"), leaf.NotAfter.UTC().Format("2006-01-02")), "")
	}

	// ── 3. the trust anchor QZ actually loads ──────────────────────────────
	anchorPath, anchorPEM, anchorErr := findInstalledAnchor(p.InstallDirs)
	var anchor *x509.Certificate
	if anchorErr != nil {
		add(checkAnchor, false, true, anchorErr.Error(),
			"run the tenant installer: it writes <QZ install dir>/override.crt (Administrator/root required)")
	} else {
		report.AnchorPath = anchorPath
		if anchor, err = parseCertificate(string(anchorPEM)); err != nil {
			add(checkAnchor, false, true, anchorPath+" exists but is not a valid certificate: "+err.Error(),
				"re-run the tenant installer to rewrite override.crt")
		} else {
			report.AnchorSHA1 = sha1Fingerprint(anchor)
			if strings.TrimSpace(p.RootPEM) != "" {
				if serverRoot, rootErr := parseCertificate(p.RootPEM); rootErr != nil {
					add(checkAnchor, false, false,
						"the server's /signing/override.crt could not be parsed: "+rootErr.Error(),
						"check GET /signing/override.crt on the server")
				} else if sha1Fingerprint(serverRoot) != report.AnchorSHA1 {
					add(checkAnchor, false, true,
						fmt.Sprintf("%s is SHA1 %s but the server publishes %s — stale or another tenant's anchor",
							anchorPath, report.AnchorSHA1, sha1Fingerprint(serverRoot)),
						"re-run the installer for THIS tenant (QZ reloads override.crt only at startup)")
					anchor = nil
				} else {
					add(checkAnchor, true, true,
						fmt.Sprintf("%s  SHA1 %s matches the server", anchorPath, report.AnchorSHA1), "")
				}
			} else {
				add(checkAnchor, true, true,
					fmt.Sprintf("%s  SHA1 %s (server CA not fetched, not compared)", anchorPath, report.AnchorSHA1), "")
			}
		}
	}

	// ── 4. the chain QZ validates ──────────────────────────────────────────
	chainOK := false
	if anchor != nil {
		pool := x509.NewCertPool()
		pool.AddCert(anchor)
		if _, verifyErr := leaf.Verify(x509.VerifyOptions{
			Roots:       pool,
			CurrentTime: now,
			KeyUsages:   []x509.ExtKeyUsage{x509.ExtKeyUsageAny},
		}); verifyErr != nil {
			add(checkChain, false, true,
				"certificate does not chain to the installed override.crt: "+verifyErr.Error(),
				"re-run the tenant installer (a wrong/missing anchor is what QZ reports as an untrusted certificate)")
		} else {
			chainOK = true
			add(checkChain, true, true,
				"chains to "+anchor.Subject.CommonName+" — QZ will accept it without a dialog", "")
		}
	} else {
		add(checkChain, false, true, "chain not verified: no usable trust anchor on this machine", "")
	}

	// ── 5. remember the decision (auto-heal) ───────────────────────────────
	whitelistedIn, exact, folded := findFingerprint(p.AllowPaths, report.Fingerprint)
	if !exact && chainOK && p.AutoHeal {
		if binary, binErr := qzBinary(p.InstallDirs); binErr == nil {
			if output, healErr := whitelistCertificate(binary, p.CertPEM); healErr == nil {
				report.Healed = "whitelisted via " + filepath.Base(binary)
				if output != "" {
					report.Healed += ": " + output
				}
				whitelistedIn, exact, folded = findFingerprint(p.AllowPaths, report.Fingerprint)
			} else if report.Healed == "" {
				report.Healed = "auto-heal failed: " + healErr.Error()
			}
		}
	}

	writableDir := firstWritableDir(p.AllowPaths)
	writableCheck := func() {
		if writableDir != "" {
			add(checkWritable, true, false, writableDir+" is writable", "")
		} else {
			add(checkWritable, false, true, "no allowed.dat directory is writable",
				"grant write permission (Windows: icacls %PROGRAMDATA%\\qz /grant *S-1-5-32-545:(OI)(CI)M)")
		}
	}

	switch {
	case exact:
		report.Whitelisted = whitelistedIn
		add(checkWhitelist, true, true, "recorded in "+whitelistedIn, "")
		add(checkWritable, true, false,
			"already recorded; QZ only appends when a new certificate arrives", "")

	case folded:
		// A legacy script wrote the fingerprint in uppercase: it is in the file
		// but QZ (String.equals against lowercase) will never see it, so the
		// dialog keeps coming back on an "installed" machine.
		report.Whitelisted = whitelistedIn
		add(checkWhitelist, false, true,
			"present in "+whitelistedIn+" but written in UPPERCASE — QZ matches the SHA-1 "+
				"case-sensitively and ignores it",
			"re-run the tenant installer: it appends the lowercase entry QZ writes itself")
		writableCheck()

	case chainOK && writableDir != "":
		add(checkWhitelist, true, true,
			"not recorded yet — the chain is valid and "+writableDir+" is writable, "+
				"so QZ records it on the first connect", "")
		add(checkWritable, true, false, writableDir+" is writable", "")

	case chainOK:
		add(checkWhitelist, false, true,
			"the fingerprint is not recorded and no allowed.dat directory is writable — "+
				"QZ cannot remember the approval, so it prompts on every connect",
			"grant write permission (Windows: icacls %PROGRAMDATA%\\qz /grant *S-1-5-32-545:(OI)(CI)M)")
		add(checkWritable, false, true, "no allowed.dat directory is writable", "")

	default:
		add(checkWhitelist, false, true,
			"fingerprint not recorded and the chain is invalid, so QZ will always prompt", "")
		writableCheck()
	}

	// ── 6. QZ's own verdict (informational) ────────────────────────────────
	if line := lastTrustLogLine(p.DebugLogPaths); line != "" {
		add(checkLog, true, false, line, "")
	} else {
		add(checkLog, true, false, "no trust-related line in QZ's debug.log yet", "")
	}

	report.OK = report.Blocking == ""
	return report
}
