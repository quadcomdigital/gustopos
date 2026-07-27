@echo off
chcp 28591 >nul 2>&1
echo ============================================
echo   GustoPOS QZ Tray Certificate Installer
echo ============================================
echo.

echo [1/5] Stopping QZ Tray ...
taskkill /F /IM "qz-tray.exe" >nul 2>&1
taskkill /F /IM "qz-tray-console.exe" >nul 2>&1
timeout /t 3 /nobreak >nul
taskkill /F /IM "qz-tray.exe" >nul 2>&1
timeout /t 2 /nobreak >nul
echo   Done.
echo.

echo [2/5] Finding QZ Tray ...
set QZ_DIR=
if exist "C:\Program Files\QZ Tray\qz-tray.exe" set "QZ_DIR=C:\Program Files\QZ Tray"
if exist "C:\Program Files (x86)\QZ Tray\qz-tray.exe" set "QZ_DIR=C:\Program Files (x86)\QZ Tray"
if "%QZ_DIR%"=="" (
    echo   ERROR: QZ Tray not found
    pause
    exit /b 1
)
echo   Found: %QZ_DIR%
echo.

echo [3/5] Installing override.crt ...
set "CERT_FILE=%QZ_DIR%\override.crt"

(
echo -----BEGIN CERTIFICATE-----
echo MIIDeDCCAmCgAwIBAgIUWWDjJMwqRaAeoISUqGwuEpfNnecwDQYJKoZIhvcNAQEL
echo BQAwVDELMAkGA1UEBhMCSVQxDTALBgNVBAgMBFJvbWUxDTALBgNVBAcMBFJvbWUx
echo ETAPBgNVBAoMCEd1c3RvUE9TMRQwEgYDVQQDDAtHdXN0b1BPUyBDQTAeFw0yNjA3
echo MjIyMjQzMzVaFw0zNjA3MTkyMjQzMzVaMFQxCzAJBgNVBAYTAklUMQ0wCwYDVQQI
echo DARSb21lMQ0wCwYDVQQHDARSb21lMREwDwYDVQQKDAhHdXN0b1BPUzEUMBIGA1UE
echo AwwLR3VzdG9QT1MgQ0EwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCu
echo zaQTN6k5sc7g56QUBYdnnfajViGwCGGYqDpPSrMZ41PdDZ6u/bpz3xOfLxaLfI2f
echo S1pGBPK/8BYT2UCjj6FTw6EEKvZ9hWQXorLNJ2iT3PM6JMqs9Tp1Scyxx0Jbp7B/
echo SknFFs4QLIRzYAF+gtd922yHmbm8milIG5cjy7LfhyHrSZ2T6e3ksefu1AQRsXHo
echo Tz7amP3UBT/5nMieGEquvB5qhTxhyHoltuQpHXqmkEGq4oLQpdRO0RJVfTuxPovm
echo Ey9gtsfUkz5nP3DxbLc9aOszr4s8lFWI+JvtNgvSB/P2tKlTRExq60JIAE1YSKCs
echo tiS5EAgcDApsKWid9R/rAgMBAAGjQjBAMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0P
echo AQH/BAQDAgEGMB0GA1UdDgQWBBR2n48C9YY7vT8n10jNBlIq2o03iDANBgkqhkiG
echo 9w0BAQsFAAOCAQEAMxvWh8RZ0GtwbYWkTyDP/jgloIE8MkL0/PmLMscDVPw9rzYr
echo rliAdHAiqefpH1572G0MMMLvj4JvwN9hSS11tOzFY3DjGcFxbj2TFFrkcEXCyZ2a
echo aWuMFvDDSWek9cVpGUREp8yiJiFYvN19whWer3oqQKhpB+vWCF/aJDZ3Mgcby7ZY
echo CsIOUHz9QVPRaZyYA6ij2k1Nzf9TyPBA1aq8DTwA83CNitZAW8+E8swo8iaExFrR
echo WAdchknAYPX4qXvRCF7pUrd1Mr5ym3iPsuWwm+rx74Z+Iad9SSDODbwDcZEaNkot
echo 6HWZdomhoeTculhsVRoEqaYOG7HzI6+VZ1q4Gw==
echo -----END CERTIFICATE-----
) > "%CERT_FILE%"

if exist "%CERT_FILE%" (
    echo   OK: override.crt written
) else (
    echo   ERROR: Failed to write certificate
)
echo.

echo [4/5] Updating whitelist ...
set "QZ_DATA=%APPDATA%\qz"
if not exist "%QZ_DATA%" mkdir "%QZ_DATA%"
set "ALLOW_FILE=%QZ_DATA%\allowed.dat"

if exist "%ALLOW_FILE%" (
    findstr /V /C:"B710176029C2378A4886B22E5D0874A7A4305FBA" "%ALLOW_FILE%" > "%ALLOW_FILE%.tmp" 2>nul
    findstr /V /C:"F4E2BF9339DBF7A80EBCDEB1071FEFB0E47FED4C" "%ALLOW_FILE%.tmp" > "%ALLOW_FILE%.tmp2" 2>nul
    move /Y "%ALLOW_FILE%.tmp2" "%ALLOW_FILE%" >nul 2>&1
    del "%ALLOW_FILE%.tmp" 2>nul
)

echo F4E2BF9339DBF7A80EBCDEB1071FEFB0E47FED4C	test.franksbar.it	GustoPOS	Jul 22 22:43:36 2026 GMT	Jul 19 22:43:36 2036 GMT	True>> "%ALLOW_FILE%"
echo   Whitelist updated

echo.
echo [5/5] Starting QZ Tray ...
if exist "%QZ_DIR%\qz-tray.exe" (
    start "" "%QZ_DIR%\qz-tray.exe"
    echo   Started.
) else (
    echo   Please start QZ Tray manually.
)
timeout /t 5 /nobreak >nul

echo.
echo ============================================
echo   DONE
echo.
echo   Open https://test.franksbar.it/print-station
echo   Keep WSS unchecked, click Connect
echo ============================================
echo.
pause
