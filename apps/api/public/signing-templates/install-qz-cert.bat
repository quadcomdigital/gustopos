@echo off
setlocal EnableExtensions
chcp 65001 >nul 2>&1
title GustoPOS QZ Tray Certificate Installer

set "ORIGIN={{ORIGIN}}"
set "TENANT={{SLUG}}"
set "PS1FILE=%TEMP%\gustopos-install-qz-cert.ps1"

echo ============================================
echo   GustoPOS QZ Tray Certificate Installer
echo   tenant : %TENANT%
echo   origin : %ORIGIN%
echo ============================================
echo.

REM The real installer lives on the tenant's origin so no certificate,
REM fingerprint or domain is ever baked into a file that can go stale.
net session >nul 2>&1
if not "%errorlevel%"=="0" (
    echo ERROR: run this script as Administrator
    echo        right-click this file ^> Run as administrator^).
    echo.
    pause
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%ORIGIN%/signing/install-qz-cert.ps1' -UseBasicParsing -OutFile '%PS1FILE%'"
if not exist "%PS1FILE%" (
    echo ERROR: could not download %ORIGIN%/signing/install-qz-cert.ps1
    echo        Check connectivity to the GustoPOS server and re-run.
    echo.
    pause
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1FILE%"
set "RC=%errorlevel%"
echo.
pause
exit /b %RC%
