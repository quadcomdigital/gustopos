@echo off
chcp 28591 >nul 2>&1
echo ============================================
echo   GustoPOS QZ Tray Certificate Debugger
echo ============================================
echo.

echo [1/6] Checking QZ Tray installation ...
set QZ_DIR=
if exist "C:\Program Files\QZ Tray\qz-tray.exe" set "QZ_DIR=C:\Program Files\QZ Tray"
if exist "C:\Program Files (x86)\QZ Tray\qz-tray.exe" set "QZ_DIR=C:\Program Files (x86)\QZ Tray"
if "%QZ_DIR%"=="" (
    echo   NOT FOUND in standard locations
) else (
    echo   Found: %QZ_DIR%
)
echo.

echo [2/6] Checking override.crt ...
set "OVERRIDE_FILE=%QZ_DIR%\override.crt"
if "%QZ_DIR%"=="" (
    echo   SKIPPED: QZ Tray dir not found
) else (
    if exist "%OVERRIDE_FILE%" (
        echo   FOUND: %OVERRIDE_FILE%
        findstr /C:"GustoPOS" "%OVERRIDE_FILE%" >nul 2>&1
        if %ERRORLEVEL%==0 (
            echo   CONTENT: GustoPOS CA (correct)
        ) else (
            findstr /C:"QZ" "%OVERRIDE_FILE%" >nul 2>&1
            if %ERRORLEVEL%==0 (
                echo   WARNING: Old QZ demo cert - run install-qz-cert.bat
            ) else (
                echo   WARNING: Unknown content
            )
        )
    ) else (
        echo   NOT FOUND - run install-qz-cert.bat to install it
    )
)
echo.

echo [3/6] Checking allowed.dat (user + machine + SYSTEM) ...
call :check_allow "%APPDATA%\qz\allowed.dat" "user"
call :check_allow "%PROGRAMDATA%\qz\allowed.dat" "machine"
call :check_allow "%WINDIR%\System32\config\systemprofile\AppData\Roaming\qz\allowed.dat" "SYSTEM"
echo.
goto :after_allow

:check_allow
if exist %1 (
    echo   FOUND [%2]: %1
    type %1
    echo.
    findstr /C:"4DBC25886175FDBADCFD734C7C9AE1BA5B9994F0" %1 >nul 2>&1
    if %ERRORLEVEL%==0 (
        echo   Our cert fingerprint: FOUND (good)
    ) else (
        echo   Our cert fingerprint: NOT FOUND
    )
) else (
    echo   NOT FOUND [%2]: %1
)
exit /b 0

:after_allow

echo [4/6] Checking debug.log ...
set "LOG_FILE=%APPDATA%\qz\debug.log"
if exist "%LOG_FILE%" (
    echo   FOUND: %LOG_FILE%
    echo.
    echo   --- Certificate entries ---
    findstr /I "certificate override rootCA Adding" "%LOG_FILE%" 2>nul
    echo.
    echo   --- Last 15 lines ---
    powershell -Command "Get-Content '%LOG_FILE%' -Tail 15"
) else (
    echo   NOT FOUND
)
echo.

echo [5/6] Testing server certificate endpoints ...
powershell -Command "try { $r = Invoke-WebRequest -Uri 'https://test.franksbar.it/api/signing/digital-certificate.txt' -UseBasicParsing -TimeoutSec 5; $c = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2([Text.Encoding]::ASCII.GetBytes($r.Content)); Write-Host '  digital-certificate: SHA1' $c.Thumbprint } catch { Write-Host '  digital-certificate ERROR:' $_.Exception.Message }"
powershell -Command "try { $r = Invoke-WebRequest -Uri 'https://test.franksbar.it/api/signing/override.crt' -UseBasicParsing -TimeoutSec 5; $c = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2([Text.Encoding]::ASCII.GetBytes($r.Content)); Write-Host '  override.crt (CA):   SHA1' $c.Thumbprint } catch { Write-Host '  override.crt ERROR:' $_.Exception.Message }"
echo.

echo [6/6] Checking QZ Tray process ...
tasklist /FI "IMAGENAME eq qz-tray.exe" 2>nul | findstr /I "qz-tray" >nul 2>&1
if %ERRORLEVEL%==0 (
    echo   QZ Tray is RUNNING
) else (
    echo   QZ Tray is NOT running
)
echo.

echo ============================================
echo   DIAGNOSIS
echo ============================================
echo.
echo   Two separate things can show "untrusted":
echo.
echo   1. BROWSER WARNING (WSS TLS cert)
echo      QZ Tray generates a self-signed TLS cert
echo      for each WSS connection. Browser shows
echo      "untrusted" because it is not in OS store.
echo      FIX: Uncheck "Use secure connection (WSS)"
echo      in print-station, use WS instead.
echo.
echo   2. QZ TRAY APPROVAL DIALOG
echo      Shows when signing cert chain fails or
echo      cert is not in allowed.dat whitelist.
echo      FIX: Run install-qz-cert.bat
echo.
echo ============================================
echo.
pause
