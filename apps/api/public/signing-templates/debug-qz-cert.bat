@echo off
setlocal EnableExtensions
chcp 65001 >nul 2>&1
title GustoPOS QZ Tray Certificate Debugger

set "ORIGIN={{ORIGIN}}"
set "TENANT={{SLUG}}"
set "PS1FILE=%TEMP%\gustopos-debug-qz-cert.ps1"

echo ============================================
echo   GustoPOS QZ Tray Certificate Debugger
echo   tenant : %TENANT%
echo   origin : %ORIGIN%
echo ============================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%ORIGIN%/signing/debug-qz-cert.ps1' -UseBasicParsing -OutFile '%PS1FILE%'"
if not exist "%PS1FILE%" (
    echo ERROR: could not download %ORIGIN%/signing/debug-qz-cert.ps1
    echo        Check connectivity to the GustoPOS server and re-run.
    echo.
    pause
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1FILE%" -Zip
set "RC=%errorlevel%"
echo.
pause
exit /b %RC%
