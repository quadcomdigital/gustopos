#Requires -Version 3.0
<#
  GustoPOS — QZ Tray certificate diagnostics (Windows)

  GENERATED for tenant "{{SLUG}}" — read-only. It never changes anything; it
  answers one question: why is QZ Tray not printing silently on this machine?

  Run it from an elevated or normal prompt and paste the output (or the zip it
  produces with -Zip) back to support.
#>

param(
  [switch]$Zip
)

$ErrorActionPreference = "Continue"

$Origin          = "{{ORIGIN}}"
$TenantSlug      = "{{SLUG}}"
$ExpectedRootSha = "{{ROOT_SHA1}}"
$ExpectedLeafSha = "{{LEAF_SHA1}}"
$ExpectedCn      = "{{CN}}"

$issues = New-Object System.Collections.Generic.List[string]

function Head([string]$t) { Write-Host "" -NoNewline; Write-Host $t -ForegroundColor Cyan }
function Ok([string]$m)   { Write-Host "  [OK]   $m" -ForegroundColor Green }
function Warn([string]$m) { Write-Host "  [WARN] $m" -ForegroundColor Yellow; $script:issues.Add($m) }
function Bad([string]$m)  { Write-Host "  [FAIL] $m" -ForegroundColor Red;    $script:issues.Add($m) }

function Get-Sha1Bytes([byte[]]$bytes) {
  $sha = [Security.Cryptography.SHA1]::Create()
  try { return ([BitConverter]::ToString($sha.ComputeHash($bytes)) -replace "-", "") }
  finally { $sha.Dispose() }
}
function Get-CertFromPem([string]$pem) {
  $body = ($pem -split "`n" | Where-Object { $_ -notmatch "-----" }) -join ""
  $bytes = [Convert]::FromBase64String($body.Trim())
  return New-Object System.Security.Cryptography.X509Certificates.X509Certificate2 -ArgumentList (, $bytes)
}
function Invoke-Download([string]$url) {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 20
  if ($r.Content -is [string]) { return $r.Content }
  return [Text.Encoding]::ASCII.GetString($r.Content)
}

Write-Host "=========================================================="
Write-Host " GustoPOS QZ Tray diagnostics — tenant '$TenantSlug'"
Write-Host " origin: $Origin"
Write-Host " $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  host: $env:COMPUTERNAME"
Write-Host "=========================================================="

# ── 1. QZ Tray install ──────────────────────────────────────────────────────
Head "[1] QZ Tray installation"
$qzDir = $null
foreach ($candidate in @("${env:ProgramFiles}\QZ Tray", "${env:ProgramFiles(x86)}\QZ Tray")) {
  if ($candidate -and (Test-Path (Join-Path $candidate "qz-tray.exe"))) { $qzDir = $candidate; break }
}
if (-not $qzDir) { Bad "QZ Tray not installed" } else { Ok "install dir: $qzDir" }
$qzRunning = $null -ne (Get-Process -Name "qz-tray" -ErrorAction SilentlyContinue)
if ($qzRunning) { Ok "qz-tray.exe is running" } else { Warn "qz-tray.exe is NOT running — start it" }

# ── 2. served certificate ───────────────────────────────────────────────────
Head "[2] Certificate served by $Origin"
$served = $null
try {
  $servedPem = Invoke-Download "$Origin/signing/digital-certificate.txt"
  $served    = Get-CertFromPem $servedPem
  $body = ($servedPem -split "`n" | Where-Object { $_ -notmatch "-----" }) -join ""
  $servedSha = Get-Sha1Bytes ([Convert]::FromBase64String($body.Trim()))
  if ($servedSha -eq $ExpectedLeafSha) { Ok "SHA1 $servedSha  CN=$($served.Subject)" }
  else { Bad "served SHA1 $servedSha != published $ExpectedLeafSha (stale server copy?)" }
  if (($served.Subject -replace "\s+", "") -notlike ("CN=" + ($ExpectedCn -replace "\s+", ""))) {
    Bad "served CN is '$($served.Subject)', expected $ExpectedCn"
  }
  if ($served.NotAfter -lt (Get-Date).ToUniversalTime()) { Bad "certificate EXPIRED $($served.NotAfter)" }
  elseif ($served.NotBefore -gt (Get-Date).ToUniversalTime()) {
    Bad "certificate NOT YET VALID (notBefore $($served.NotBefore)) — is this machine's clock right?"
  }
} catch {
  Bad "cannot download $Origin/signing/digital-certificate.txt — $($_.Exception.Message)"
}

# ── 3. override.crt (the trust anchor) ──────────────────────────────────────
Head "[3] override.crt (trust anchor read by QZ at startup)"
$installedCa = $null
if ($qzDir) {
  $overridePath = Join-Path $qzDir "override.crt"
  if (Test-Path $overridePath) {
    try {
      $installedCa = Get-CertFromPem ([IO.File]::ReadAllText($overridePath))
      $caSha = Get-Sha1Bytes ([Convert]::FromBase64String((( [IO.File]::ReadAllText($overridePath) -split "`n" |
        Where-Object { $_ -notmatch "-----" }) -join "").Trim()))
      if ($caSha -eq $ExpectedRootSha) { Ok "$overridePath  SHA1 $caSha" }
      else { Bad "$overridePath  SHA1 $caSha != published $ExpectedRootSha — wrong tenant or stale CA" }
      if ($installedCa.Subject -ne $installedCa.Issuer) { Bad "override.crt is not self-signed (cannot be a trust anchor)" }
    } catch { Bad "$overridePath exists but cannot be parsed: $($_.Exception.Message)" }
  } else {
    Bad "$overridePath NOT FOUND — QZ has no GustoPOS trust anchor, every certificate shows 'Untrusted website'. Run install-qz-cert.ps1"
  }
} else {
  Bad "cannot check override.crt: QZ Tray directory unknown"
}

# ── 4. does the served leaf belong to the installed CA? ─────────────────────
Head "[4] Chain (served certificate -> installed override.crt)"
if ($served -and $installedCa) {
  if ($served.Issuer -eq $installedCa.Subject) { Ok "issuer '$($served.Issuer)' matches the installed CA subject" }
  else { Bad "served certificate was issued by '$($served.Issuer)' but the installed CA is '$($installedCa.Subject)' — override.crt is for another tenant/rotation" }
} else {
  Warn "skipped (missing certificate or override.crt)"
}

# ── 5. allowed.dat ──────────────────────────────────────────────────────────
Head "[5] allowed.dat (user / machine / SYSTEM)"
$allowPaths = @(
  (Join-Path $env:APPDATA "qz\allowed.dat"),
  (Join-Path $env:ProgramData "qz\allowed.dat"),
  (Join-Path $env:WINDIR "System32\config\systemprofile\AppData\Roaming\qz\allowed.dat")
)
$foundAllow = $false
foreach ($path in $allowPaths) {
  if (Test-Path $path) {
    $content = [IO.File]::ReadAllText($path)
    if ($content -match [regex]::Escape($ExpectedLeafSha)) {
      Ok "$path — fingerprint present"
      $foundAllow = $true
    } else {
      Warn "$path — exists but the current fingerprint is missing (expected $ExpectedLeafSha)"
    }
    ($content -split "`r?`n") | Where-Object { $_.Trim() } | ForEach-Object {
      Write-Host "         $_" -ForegroundColor DarkGray
    }
  } else {
    Warn "$path — not found"
  }
}
$dir = Join-Path $env:ProgramData "qz"
if (Test-Path $dir) {
  try {
    $probe = Join-Path $dir ".write-probe"
    [IO.File]::WriteAllText($probe, "probe"); Remove-Item $probe -Force
    Ok "$dir is writable by $(whoami)"
  } catch {
    Bad "$dir is NOT writable by $(whoami) — QZ cannot record its own approvals here (grant Users modify)"
  }
}
if (-not $foundAllow) { Warn "the certificate is not whitelisted anywhere — QZ will prompt (and the agent will time out after 15s)" }

# ── 6. clock ────────────────────────────────────────────────────────────────
Head "[6] Clock"
try {
  $r = Invoke-WebRequest -Uri "$Origin/" -UseBasicParsing -Method Head -TimeoutSec 15
  $serverDate = [DateTime]::Parse($r.Headers["Date"]).ToUniversalTime()
  $localDate  = (Get-Date).ToUniversalTime()
  $skew = [math]::Round(($localDate - $serverDate).TotalSeconds)
  if ([math]::Abs($skew) -gt 900) {
    Bad "clock skew ${skew}s (> 15 min): QZ rejects signatures older/newer than VALID_SIGNING_PERIOD and reports 'Future/Expired Certificate'"
  } else {
    Ok "clock skew vs server: ${skew}s"
  }
} catch { Warn "cannot compare the clock with the server: $($_.Exception.Message)" }

# ── 7. QZ debug.log ─────────────────────────────────────────────────────────
Head "[7] QZ debug.log (last trust decisions)"
$logPath = Join-Path $env:APPDATA "qz\debug.log"
if (Test-Path $logPath) {
  $lines = Get-Content $logPath -ErrorAction SilentlyContinue |
    Where-Object { $_ -match "Adding CA certificate|Successfully chained certificate|Problem building certificate chain|Certificate is expired|Cannot write to file|whitelist|allowed" } |
    Select-Object -Last 15
  if ($lines) { $lines | ForEach-Object { Write-Host "         $_" -ForegroundColor DarkGray } }
  else { Warn "no trust-related lines found in $logPath (is debug logging enabled?)" }
} else {
  Warn "$logPath not found"
}

# ── verdict ─────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=========================================================="
if ($issues.Count -eq 0) {
  Write-Host " RESULT: everything looks correct — silent printing should work." -ForegroundColor Green
} else {
  Write-Host " RESULT: $($issues.Count) problem(s) found:" -ForegroundColor Red
  $i = 1
  foreach ($issue in $issues) { Write-Host ("  {0}. {1}" -f $i, $issue) -ForegroundColor Red; $i++ }
  Write-Host ""
  Write-Host " Fix: run install-qz-cert.ps1 from $Origin/signing/" -ForegroundColor Yellow
}
Write-Host "=========================================================="

if ($Zip) {
  $bundle = Join-Path $env:TEMP "gustopos-qz-diagnostics.zip"
  $stage  = Join-Path $env:TEMP ("gustopos-qz-diagnostics-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
  New-Item -ItemType Directory -Path $stage -Force | Out-Null
  if ($qzDir) { Copy-Item (Join-Path $qzDir "override.crt") $stage -ErrorAction SilentlyContinue }
  foreach ($path in $allowPaths) { if (Test-Path $path) { Copy-Item $path $stage -ErrorAction SilentlyContinue } }
  if (Test-Path $logPath) { Get-Content $logPath -Tail 400 | Set-Content (Join-Path $stage "debug-tail.log") }
  Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $bundle -Force
  Write-Host ""
  Write-Host "Bundle written to: $bundle" -ForegroundColor Yellow
}

exit $(if ($issues.Count -eq 0) { 0 } else { 1 })
