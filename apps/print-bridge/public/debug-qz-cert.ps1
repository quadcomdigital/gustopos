# GustoPOS QZ Tray Certificate Diagnostic
# Paste this into PowerShell on the Windows machine

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  GustoPOS QZ Tray Certificate Diagnostic" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# 1. Find QZ Tray
Write-Host "[1/5] QZ Tray installation ..." -ForegroundColor Yellow
$qzDir = $null
if (Test-Path "C:\Program Files\QZ Tray\qz-tray.exe") { $qzDir = "C:\Program Files\QZ Tray" }
if (Test-Path "C:\Program Files (x86)\QZ Tray\qz-tray.exe") { $qzDir = "C:\Program Files (x86)\QZ Tray" }
if ($qzDir) {
    Write-Host "  Found: $qzDir" -ForegroundColor Green
} else {
    Write-Host "  NOT FOUND" -ForegroundColor Red
}
Write-Host ""

# 2. Check override.crt
Write-Host "[2/5] override.crt ..." -ForegroundColor Yellow
if ($qzDir) {
    $overridePath = Join-Path $qzDir "override.crt"
    if (Test-Path $overridePath) {
        Write-Host "  Found: $overridePath" -ForegroundColor Green
        $cert = Get-Content $overridePath -Raw
        if ($cert -match "GustoPOS") {
            Write-Host "  Content: Contains GustoPOS CA (correct)" -ForegroundColor Green
        } elseif ($cert -match "QZ") {
            Write-Host "  WARNING: Contains old QZ demo cert!" -ForegroundColor Red
        } else {
            Write-Host "  Content: Unknown" -ForegroundColor Yellow
        }
        # Show the cert details
        Write-Host ""
        Write-Host "  Cert details:" -ForegroundColor Cyan
        $certObj = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2([System.Text.Encoding]::ASCII.GetBytes($cert))
        Write-Host "    Subject: $($certObj.Subject)"
        Write-Host "    Issuer:  $($certObj.Issuer)"
        Write-Host "    Serial:  $($certObj.SerialNumber)"
        Write-Host "    SHA1:    $($certObj.Thumbprint)"
        Write-Host ""
        # Compare with server
        Write-Host "  Expected (from server):" -ForegroundColor Cyan
        Write-Host "    Subject: CN = GustoPOS CA, O = GustoPOS, L = Rome, ST = Rome, C = IT"
        Write-Host "    SHA1:    70B95F28386CDBDD1C09FFB842FF125F308C9F26"
        if ($certObj.Thumbprint -eq "70B95F28386CDBDD1C09FFB842FF125F308C9F26") {
            Write-Host "  MATCH!" -ForegroundColor Green
        } else {
            Write-Host "  MISMATCH! This is the problem." -ForegroundColor Red
        }
    } else {
        Write-Host "  NOT FOUND: $overridePath" -ForegroundColor Red
        Write-Host "  This is likely the problem!" -ForegroundColor Red
    }
} else {
    Write-Host "  SKIPPED: QZ Tray not found" -ForegroundColor Yellow
}
Write-Host ""

# 3. Check allowed.dat
Write-Host "[3/5] allowed.dat (whitelist) ..." -ForegroundColor Yellow
$allowFile = Join-Path $env:APPDATA "qz\allowed.dat"
if (Test-Path $allowFile) {
    Write-Host "  Found: $allowFile" -ForegroundColor Green
    Write-Host "  Contents:"
    Get-Content $allowFile | ForEach-Object { Write-Host "    $_" }
    if (Select-String -Path $allowFile -Pattern "F4E2BF9339DBF7A80EBCDEB1071FEFB0E47FED4C") {
        Write-Host "  Our cert fingerprint: FOUND" -ForegroundColor Green
    } else {
        Write-Host "  Our cert fingerprint: NOT FOUND" -ForegroundColor Red
    }
} else {
    Write-Host "  NOT FOUND" -ForegroundColor Red
}
Write-Host ""

# 4. Check debug.log
Write-Host "[4/5] debug.log ..." -ForegroundColor Yellow
$logFile = Join-Path $env:APPDATA "qz\debug.log"
if (Test-Path $logFile) {
    Write-Host "  Found: $logFile" -ForegroundColor Green
    Write-Host ""
    Write-Host "  --- Certificate entries ---" -ForegroundColor Cyan
    Select-String -Path $logFile -Pattern "certificate|override|rootCA|Adding CA|GustoPOS|chain" -AllMatches | Select-Object -Last 15 | ForEach-Object { Write-Host "    $_" }
    Write-Host ""
    Write-Host "  --- Last 10 lines ---" -ForegroundColor Cyan
    Get-Content $logFile -Tail 10 | ForEach-Object { Write-Host "    $_" }
} else {
    Write-Host "  NOT FOUND" -ForegroundColor Red
}
Write-Host ""

# 5. Test server
Write-Host "[5/5] Server connectivity ..." -ForegroundColor Yellow
try {
    $r = Invoke-WebRequest -Uri "https://test.franksbar.it/signing/digital-certificate.txt" -UseBasicParsing -TimeoutSec 5
    Write-Host "  Digital certificate: OK ($($r.Content.Length) bytes)" -ForegroundColor Green
    # Verify chain
    $leafPem = $r.Content
    try {
        $overrideCert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2([System.Text.Encoding]::ASCII.GetBytes((Get-Content (Join-Path $qzDir "override.crt") -Raw)))
        Write-Host "  Can read override.crt: YES" -ForegroundColor Green
    } catch {
        Write-Host "  Can read override.crt: NO - $($_.Exception.Message)" -ForegroundColor Red
    }
} catch {
    Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  SUMMARY" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  If override.crt shows MISMATCH or NOT FOUND,"
Write-Host "  run this command to fix it:"
Write-Host ""
Write-Host '  Stop-Process -Name "qz-tray" -Force -ErrorAction SilentlyContinue' -ForegroundColor Yellow
Write-Host '  Start-Sleep -Seconds 3' -ForegroundColor Yellow
Write-Host '  Invoke-WebRequest -Uri "https://test.franksbar.it/signing/override.crt" -OutFile "C:\Program Files\QZ Tray\override.crt" -UseBasicParsing' -ForegroundColor Yellow
Write-Host '  Start-Process "C:\Program Files\QZ Tray\qz-tray.exe"' -ForegroundColor Yellow
Write-Host ""
