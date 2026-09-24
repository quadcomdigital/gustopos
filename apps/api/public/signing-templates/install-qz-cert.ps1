#Requires -Version 3.0
<#
  GustoPOS — QZ Tray certificate installer (Windows)

  GENERATED for tenant "{{SLUG}}" — do not edit. Re-download it from
  {{ORIGIN}}/signing/install-qz-cert.ps1 whenever the certificate rotates.

  Why this exists: QZ Tray only prints silently when the certificate it
  receives chains to a CA it has loaded from <install dir>/override.crt
  (qz/auth/Certificate.java). Nothing here is hardcoded — the CA, the leaf
  and their SHA-1 fingerprints are downloaded from the tenant's own origin
  and pinned against the values published by the server, so an installer can
  never install another tenant's (or a stale) certificate.

  Steps: admin check -> download+verify -> stop QZ -> write override.crt ->
         whitelist the leaf -> restart QZ -> verify from disk.
#>

$ErrorActionPreference = "Stop"

$Origin          = "{{ORIGIN}}"
$TenantSlug      = "{{SLUG}}"
$ExpectedRootSha = "{{ROOT_SHA1}}"
$ExpectedLeafSha = "{{LEAF_SHA1}}"
$ExpectedCn      = "{{CN}}"
# QZ Tray stores the SHA-1 in allowed.dat in LOWERCASE
# (qz/utils/ByteUtilities.toHexString(digest, upperCase=false)) and matches it
# case-sensitively, so every fingerprint comparison and every line written here
# must be lowercase — an uppercase entry is simply never seen by QZ.
$ExpectedRootShaLc = $ExpectedRootSha.ToLowerInvariant()
$ExpectedLeafShaLc = $ExpectedLeafSha.ToLowerInvariant()

function Step([int]$n, [string]$msg) {
  Write-Host ("[{0}/6] {1}" -f $n, $msg) -ForegroundColor Cyan
}
function Ok([string]$msg) { Write-Host ("       {0}" -f $msg) -ForegroundColor DarkGray }
function Fail([string]$msg) {
  Write-Host ""
  Write-Host ("FAILED: {0}" -f $msg) -ForegroundColor Red
  exit 1
}

function Get-Sha1([byte[]]$bytes) {
  $sha = [Security.Cryptography.SHA1]::Create()
  try {
    return ([BitConverter]::ToString($sha.ComputeHash($bytes)) -replace "-", "")
  } finally { $sha.Dispose() }
}

function Get-PemBytes([string]$pem) {
  $body = ($pem -split "`n" | Where-Object { $_ -notmatch "-----" }) -join ""
  return [Convert]::FromBase64String($body.Trim())
}

function Get-CertFromPem([string]$pem) {
  return New-Object System.Security.Cryptography.X509Certificates.X509Certificate2 -ArgumentList (, (Get-PemBytes $pem))
}

function Invoke-Download([string]$url) {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 30
  if ($response.Content -is [string]) { return $response.Content }
  return [Text.Encoding]::ASCII.GetString($response.Content)
}

# ── 1. administrator ────────────────────────────────────────────────────────
Step 1 "Administrator check"
$identity  = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Fail "Run as Administrator (right-click the file > Run as administrator). Without it neither C:\Program Files\QZ Tray\override.crt nor %PROGRAMDATA%\qz\allowed.dat can be written — which is exactly what makes QZ Tray report the certificate as untrusted."
}
Ok "elevated"

# ── 2. download and verify the tenant CA + leaf ─────────────────────────────
Step 2 "Downloading signing material from $Origin"
try {
  $caPem  = Invoke-Download "$Origin/signing/override.crt"
  $leafPem = Invoke-Download "$Origin/signing/digital-certificate.txt"
} catch {
  Fail "download failed: $($_.Exception.Message)"
}
if ($caPem -notmatch "BEGIN CERTIFICATE") { Fail "$Origin/signing/override.crt is not a PEM certificate" }
if ($leafPem -notmatch "BEGIN CERTIFICATE") { Fail "$Origin/signing/digital-certificate.txt is not a PEM certificate" }

$ca   = Get-CertFromPem $caPem
$leaf = Get-CertFromPem $leafPem

$caSha   = (Get-Sha1 (Get-PemBytes $caPem)).ToLowerInvariant()
$leafSha = (Get-Sha1 (Get-PemBytes $leafPem)).ToLowerInvariant()
Ok "override.crt  SHA1 $($caSha.ToUpperInvariant())"
Ok "certificate   SHA1 $($leafSha.ToUpperInvariant())  CN=$($leaf.Subject)"

if ($caSha -ne $ExpectedRootShaLc) {
  Fail "override.crt fingerprint mismatch (got $caSha, server publishes $ExpectedRootSha). Wrong origin or a certificate rotation is pending."
}
if ($leafSha -ne $ExpectedLeafShaLc) {
  Fail "certificate fingerprint mismatch (got $leafSha, server publishes $ExpectedLeafSha)."
}
# .NET renders "CN=GustoPOS Casale, O=…" (no spaces); normalise both sides.
$subjectFlat  = ($leaf.Subject -replace "\s+", "")
$expectedFlat = "CN=" + ($ExpectedCn -replace "\s+", "")
if (-not $subjectFlat.Contains($expectedFlat)) {
  Fail "certificate subject is '$($leaf.Subject)', expected CN=$ExpectedCn."
}
if ($ca.Subject -ne $ca.Issuer) { Fail "override.crt is not self-signed — it cannot be a trust anchor." }

# basicConstraints extension OID = 2.5.29.19
$basicConstraints = $ca.Extensions |
  Where-Object { $_.Oid.Value -eq "2.5.29.19" } |
  Select-Object -First 1
if ($basicConstraints -ne $null) {
  $bc = [Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]$basicConstraints
  if (-not $bc.CertificateAuthority) { Fail "override.crt does not have basicConstraints CA:TRUE" }
}
Ok "pinned against the server-published fingerprints"

# ── 3. locate QZ Tray and stop it ───────────────────────────────────────────
Step 3 "Locating QZ Tray"
$qzDir = $null
foreach ($candidate in @(
    "${env:ProgramFiles}\QZ Tray",
    "${env:ProgramFiles(x86)}\QZ Tray")) {
  if ($candidate -and (Test-Path (Join-Path $candidate "qz-tray.exe"))) { $qzDir = $candidate; break }
}
if (-not $qzDir) {
  $cmd = Get-Command "qz-tray.exe" -ErrorAction SilentlyContinue
  if ($cmd) { $qzDir = Split-Path $cmd.Source }
}
if (-not $qzDir) { Fail "QZ Tray not found. Install it from https://qz.io/download/ then re-run this script." }
Ok $qzDir

Write-Host "       Stopping QZ Tray..." -ForegroundColor DarkGray
Stop-Process -Name "qz-tray" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "qz-tray-console" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3

# ── 4. write override.crt (the tenant's trust anchor) ───────────────────────
Step 4 "Installing override.crt"
$overridePath = Join-Path $qzDir "override.crt"
try {
  [IO.File]::WriteAllText($overridePath, $caPem, (New-Object Text.ASCIIEncoding))
} catch {
  Fail "cannot write $overridePath ($($_.Exception.Message)) — the QZ Tray directory must be writable by an administrator."
}
$writtenSha = (Get-Sha1 (Get-PemBytes ([IO.File]::ReadAllText($overridePath)))).ToLowerInvariant()
if ($writtenSha -ne $ExpectedRootShaLc) {
  Fail "$overridePath does not contain the expected CA after writing (got $writtenSha)."
}
Ok "$overridePath  SHA1 $ExpectedRootSha"

# ── 5. whitelist the leaf so no dialog ever appears ─────────────────────────
Step 5 "Whitelisting the certificate"
$leafFile = Join-Path $env:TEMP "gustopos-{{SLUG}}-digital-certificate.txt"
[IO.File]::WriteAllText($leafFile, $leafPem, (New-Object Text.ASCIIEncoding))

$qzConsole = Join-Path $qzDir "qz-tray-console.exe"
$whitelisted = $false
if (Test-Path $qzConsole) {
  # Elevated -> QZ writes the machine-wide %PROGRAMDATA%\qz\allowed.dat
  & $qzConsole --allow $leafFile 2>&1 | ForEach-Object { Ok "$_" }
  $whitelisted = $true
} else {
  Write-Host "       qz-tray-console.exe not found — writing allowed.dat manually" -ForegroundColor DarkYellow
}

# QZ also reads the per-user copy (FileUtilities.USER_DIR), and a manually
# written machine file may not be readable by the interactive user: append the
# canonical line to both. Only the first tab-separated field (the fingerprint)
# is used to match, the rest keeps the file readable in QZ's "Saved sites".
$notBefore = $leaf.NotBefore.ToUniversalTime().ToString("yyyy-MM-dd HH:mm:ss")
$notAfter  = $leaf.NotAfter.ToUniversalTime().ToString("yyyy-MM-dd HH:mm:ss")
$org = ""
if ($leaf.Subject -match "O=([^,]+)") { $org = $Matches[1].Trim() }
$line = ("{0}`t{1}`t{2}`t{3}`t{4}`tTrue" -f $ExpectedLeafShaLc, $ExpectedCn, $org, $notBefore, $notAfter)

$allowDirs = @(
  (Join-Path $env:APPDATA "qz"),
  (Join-Path $env:ProgramData "qz"),
  (Join-Path $env:WINDIR "System32\config\systemprofile\AppData\Roaming\qz")
)
foreach ($dir in $allowDirs) {
  try {
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $allowFile = Join-Path $dir "allowed.dat"
    $existing = ""
    if (Test-Path $allowFile) { $existing = [IO.File]::ReadAllText($allowFile) }
    # Case-sensitive on purpose: QZ matches the SHA-1 with String.equals
    # against its lowercase value, so a legacy UPPERCASE entry must not stop us
    # from writing the line QZ actually accepts.
    if (-not ($existing -clike ("*" + $ExpectedLeafShaLc + "*"))) {
      [IO.File]::WriteAllText($allowFile, ($existing + $line + "`r`n"), (New-Object Text.UTF8Encoding $false))
    }
    if (Test-Path $allowFile) { Ok "$allowFile" }
    $whitelisted = $true
  } catch {
    Write-Host "       cannot write $dir ($($_.Exception.Message))" -ForegroundColor Yellow
  }
}
if (-not $whitelisted) { Fail "could not whitelist the certificate in any allowed.dat location." }

# The shared directory must stay writable: QZ appends to allowed.dat itself
# whenever a new certificate chains to override.crt.
& icacls (Join-Path $env:ProgramData "qz") /grant "*S-1-5-32-545:(OI)(CI)M" | Out-Null

# ── 6. restart QZ Tray ──────────────────────────────────────────────────────
Step 6 "Restarting QZ Tray"
Start-Process (Join-Path $qzDir "qz-tray.exe")
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "DONE — tenant '$TenantSlug'" -ForegroundColor Green
Write-Host "  override.crt : $overridePath (SHA1 $ExpectedRootSha)"
Write-Host "  certificate  : SHA1 $ExpectedLeafSha (CN=$ExpectedCn)"
Write-Host ""
Write-Host "  Next: restart the GustoPOS print agent, then print a test ticket."
Write-Host "  No QZ Tray dialog should appear."
Write-Host "  If anything still fails, run debug-qz-cert.ps1 from the same origin."
Write-Host ""
exit 0
