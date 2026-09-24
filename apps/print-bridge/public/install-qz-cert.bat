@echo off
setlocal EnableExtensions
chcp 28591 >nul 2>&1
title GustoPOS QZ Tray Certificate Installer

echo ============================================
echo   GustoPOS QZ Tray Certificate Installer
echo   silent printing: override.crt + allowed.dat
echo ============================================
echo.

REM --- Requires Administrator (writes Program Files / ProgramData) ---
net session >nul 2>&1
if not "%errorlevel%"=="0" (
    echo ERROR: run this script as Administrator
    echo        (right-click the file  ^>  Run as administrator^).
    echo.
    pause
    exit /b 1
)

REM --- Embedded certificates (base64, no network needed) ---
REM CA:   CN=GustoPOS CA   SHA1 70B95F28386CDBDD1C09FFB842FF125F308C9F26
REM Leaf: CN=GustoPOS      SHA1 4DBC25886175FDBADCFD734C7C9AE1BA5B9994F0
set "CA_B64=LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSURlRENDQW1DZ0F3SUJBZ0lVV1dEakpNd3FSYUFlb0lTVXFHd3VFcGZObmVjd0RRWUpLb1pJaHZjTkFRRUwKQlFBd1ZERUxNQWtHQTFVRUJoTUNTVlF4RFRBTEJnTlZCQWdNQkZKdmJXVXhEVEFMQmdOVkJBY01CRkp2YldVeApFVEFQQmdOVkJBb01DRWQxYzNSdlVFOVRNUlF3RWdZRFZRUUREQXRIZFhOMGIxQlBVeUJEUVRBZUZ3MHlOakEzCk1qSXlNalF6TXpWYUZ3MHpOakEzTVRreU1qUXpNelZhTUZReEN6QUpCZ05WQkFZVEFrbFVNUTB3Q3dZRFZRUUkKREFSU2IyMWxNUTB3Q3dZRFZRUUhEQVJTYjIxbE1SRXdEd1lEVlFRS0RBaEhkWE4wYjFCUFV6RVVNQklHQTFVRQpBd3dMUjNWemRHOVFUMU1nUTBFd2dnRWlNQTBHQ1NxR1NJYjNEUUVCQVFVQUE0SUJEd0F3Z2dFS0FvSUJBUUN1CnphUVRONms1c2M3ZzU2UVVCWWRubmZhalZpR3dDR0dZcURwUFNyTVo0MVBkRFo2dS9icHozeE9mTHhhTGZJMmYKUzFwR0JQSy84QllUMlVDamo2RlR3NkVFS3ZaOWhXUVhvckxOSjJpVDNQTTZKTXFzOVRwMVNjeXh4MEpicDdCLwpTa25GRnM0UUxJUnpZQUYrZ3RkOTIyeUhtYm04bWlsSUc1Y2p5N0xmaHlIclNaMlQ2ZTNrc2VmdTFBUVJzWEhvClR6N2FtUDNVQlQvNW5NaWVHRXF1dkI1cWhUeGh5SG9sdHVRcEhYcW1rRUdxNG9MUXBkUk8wUkpWZlR1eFBvdm0KRXk5Z3RzZlVrejVuUDNEeGJMYzlhT3N6cjRzOGxGV0krSnZ0Tmd2U0IvUDJ0S2xUUkV4cTYwSklBRTFZU0tDcwp0aVM1RUFnY0RBcHNLV2lkOVIvckFnTUJBQUdqUWpCQU1BOEdBMVVkRXdFQi93UUZNQU1CQWY4d0RnWURWUjBQCkFRSC9CQVFEQWdFR01CMEdBMVVkRGdRV0JCUjJuNDhDOVlZN3ZUOG4xMGpOQmxJcTJvMDNpREFOQmdrcWhraUcKOXcwQkFRc0ZBQU9DQVFFQU14dldoOFJaMEd0d2JZV2tUeURQL2pnbG9JRThNa0wwL1BtTE1zY0RWUHc5cnpZcgpybGlBZEhBaXFlZnBIMTU3MkcwTU1NTHZqNEp2d045aFNTMTF0T3pGWTNEakdjRnhiajJURkZya2NFWEN5WjJhCmFXdU1GdkREU1dlazljVnBHVVJFcDh5aUppRll2TjE5d2hXZXIzb3FRS2hwQit2V0NGL2FKRFozTWdjYnk3WlkKQ3NJT1VIejlRVlBSYVp5WUE2aWoyazFOemY5VHlQQkExYXE4RFR3QTgzQ05pdFpBVzgrRThzd284aWFFeEZyUgpXQWRjaGtuQVlQWDRxWHZSQ0Y3cFVyZDFNcjV5bTNpUHN1V3dtK3J4NzRaK0lhZDlTU0RPRGJ3RGNaRWFOa290CjZIV1pkb21ob2VUY3VsaHNWUm9FcWFZT0c3SHpJNitWWjFxNEd3PT0KLS0tLS1FTkQgQ0VSVElGSUNBVEUtLS0tLQo="
set "LEAF_B64=LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSUVBVENDQXVtZ0F3SUJBZ0lVZmhmUXdIS0ZZQURmZllqajdBQS9LWlovZ3JBd0RRWUpLb1pJaHZjTkFRRUwKQlFBd1ZERUxNQWtHQTFVRUJoTUNTVlF4RFRBTEJnTlZCQWdNQkZKdmJXVXhEVEFMQmdOVkJBY01CRkp2YldVeApFVEFQQmdOVkJBb01DRWQxYzNSdlVFOVRNUlF3RWdZRFZRUUREQXRIZFhOMGIxQlBVeUJEUVRBZUZ3MHlOakE1Ck1qUXhOak0zTlRoYUZ3MHpOakE1TWpFeE5qTTNOVGhhTUZFeEN6QUpCZ05WQkFZVEFrbFVNUTB3Q3dZRFZRUUkKREFSU2IyMWxNUTB3Q3dZRFZRUUhEQVJTYjIxbE1SRXdEd1lEVlFRS0RBaEhkWE4wYjFCUFV6RVJNQThHQTFVRQpBd3dJUjNWemRHOVFUMU13Z2dFaU1BMEdDU3FHU0liM0RRRUJBUVVBQTRJQkR3QXdnZ0VLQW9JQkFRRElHQW5sCmtXNTlaT3lVTEQzTzhFR01TRlNlNzZJWEdoS29WR1JOaENVUllqeVZWc0RURklCUk1zQkNtMFl1L1FJdExqdEwKYzl5eTh0d0RJY3o3dDBySGVET3d2UFBHT2J4UlBqZGtXYm1VSmE5aXZZbWRyZlBkNXNLOGJHY0kzWjVFcUp4OQp4VnNkY2E3ejUrMjQvVE9wd05MaW83dEY4Rkx5Y3FVWVh5UThpbTVSajZUK3FwVDZDL3FWS1lkREhiRVhtelR0Ck9OWEo3bGlwOVQ5bU5MQkxTSXlFUm9Xb1g1R1JsandWR1I1R2d4cTFHa2F1YytHTE0xMTNGWndsN0UwR3g5WnAKSFdOMlBqUml2NHU1TmxmSHV2b1lQYUNoTFNISlh0c21OMlRnSlUvWDNHM1F2UnMxMUtFVy9sS0U5VDNudzlVLwo3VVA3MEVHRGRCSUYrMjlwQWdNQkFBR2pnYzB3Z2Nvd0NRWURWUjBUQkFJd0FEQU9CZ05WSFE4QkFmOEVCQU1DCkI0QXdIUVlEVlIwbEJCWXdGQVlJS3dZQkJRVUhBd0VHQ0NzR0FRVUZCd01DTUU0R0ExVWRFUVJITUVXQ0VYUmwKYzNRdVpuSmhibXR6WW1GeUxtbDBnaDkwWlhOMExtRnVkR2xqYjJOaGMyRnNaWEpwWTJWMmFXMWxiblJwTG1sMApnZ2xzYjJOaGJHaHZjM1NIQkg4QUFBRXdIUVlEVlIwT0JCWUVGSHNrZ1VnK0ZmdlZBM0RRQWNYdnEyN096R0N6Ck1COEdBMVVkSXdRWU1CYUFGSGFmandMMWhqdTlQeWZYU00wR1VpcmFqVGVJTUEwR0NTcUdTSWIzRFFFQkN3VUEKQTRJQkFRQ1E2ZlBWN28zV3BsNEJSZEtlV3VNa2ZEcWdLL0ZQTG9IajczbUkyV2RoTkFTOU1QaXMzRHNQVmVhbQo2ampOWG45UW40S1dVenlXQXZXQVZ2WXRteW5rQ051QW51WXBJUS8yVDFXNk83ejBoYkhWUWVnYnlSR1l5a2ZQCnRyamF2WnBiWW4wTVU0eURzdUJOWGt6VEFwT1RnNUNmTVRJa012Ni96bjNxMjl6dHlhdUJ3MGJwYXRlWFV3RWgKUm9RYUVNZDRVelhBUTljbXpOczlWYzJMQ1FMeUg1bTRZSUxrcFpYMm1VSjhUeDRIb2hvVDUvNmVJNGVmZFdOSgpsMzFQM1lMVHM1MDZxaERDSkxyZ04yc3dRWXdYbjNLYXVBMm1mZUV0NlJ5SmtMUUM4NXlIN25xRjlvdUtVSmErCktOWGlEVGpxM3gvWDRmWVM0dGJWZXRzUE9uODcKLS0tLS1FTkQgQ0VSVElGSUNBVEUtLS0tLQo="

echo [1/6] Stopping QZ Tray ...
taskkill /F /IM "qz-tray.exe" >nul 2>&1
taskkill /F /IM "qz-tray-console.exe" >nul 2>&1
timeout /t 3 /nobreak >nul
echo   Done.
echo.

echo [2/6] Finding QZ Tray ...
set "QZ_DIR="
if exist "C:\Program Files\QZ Tray\qz-tray.exe" set "QZ_DIR=C:\Program Files\QZ Tray"
if exist "C:\Program Files (x86)\QZ Tray\qz-tray.exe" set "QZ_DIR=C:\Program Files (x86)\QZ Tray"
if not defined QZ_DIR (
    for /d %%D in ("C:\Program Files*\QZ Tray") do if exist "%%~fD\qz-tray.exe" set "QZ_DIR=%%~fD"
)
if not defined QZ_DIR (
    echo   ERROR: QZ Tray not found.
    echo   Install QZ Tray from https://qz.io/download/ then re-run this script.
    echo.
    pause
    exit /b 1
)
echo   Found: %QZ_DIR%
echo.

echo [3/6] Installing override.crt (GustoPOS CA, trusted root) ...
set "CERT_FILE=%QZ_DIR%\override.crt"
powershell -NoProfile -ExecutionPolicy Bypass -Command "[IO.File]::WriteAllText($env:CERT_FILE, [Text.Encoding]::ASCII.GetString([Convert]::FromBase64String($env:CA_B64)))"
if not exist "%CERT_FILE%" (
    echo   ERROR: failed to write %CERT_FILE%
    echo.
    pause
    exit /b 1
)
echo   OK: %CERT_FILE%
echo.

echo [4/6] Writing current digital certificate ...
set "LEAF_FILE=%TEMP%\gustopos-digital-certificate.txt"
powershell -NoProfile -ExecutionPolicy Bypass -Command "[IO.File]::WriteAllText($env:LEAF_FILE, [Text.Encoding]::ASCII.GetString([Convert]::FromBase64String($env:LEAF_B64)))"
echo   OK: %LEAF_FILE%
echo.

echo [5/6] Trusting certificate (allowed.dat: per-user + per-machine) ...
set "QZ_CONSOLE=%QZ_DIR%\qz-tray-console.exe"
if exist "%QZ_CONSOLE%" (
    "%QZ_CONSOLE%" --allow "%LEAF_FILE%"
) else (
    echo   WARNING: qz-tray-console.exe not found - writing allowed.dat manually.
    if not exist "%APPDATA%\qz" mkdir "%APPDATA%\qz"
    findstr /V /C:"F4E2BF9339DBF7A80EBCDEB1071FEFB0E47FED4C" "%APPDATA%\qz\allowed.dat" > "%APPDATA%\qz\allowed.dat.tmp" 2>nul
    if exist "%APPDATA%\qz\allowed.dat.tmp" move /Y "%APPDATA%\qz\allowed.dat.tmp" "%APPDATA%\qz\allowed.dat" >nul 2>&1
    echo 4DBC25886175FDBADCFD734C7C9AE1BA5B9994F0	GustoPOS	GustoPOS	Sep 24 16:37:58 2026 GMT	Sep 21 16:37:58 2036 GMT	True>> "%APPDATA%\qz\allowed.dat"
)
if not exist "%APPDATA%\qz\allowed.dat" (
    echo   ERROR: allowed.dat was not created.
    echo.
    pause
    exit /b 1
)
echo   User whitelist   : %APPDATA%\qz\allowed.dat
if not exist "%PROGRAMDATA%\qz" mkdir "%PROGRAMDATA%\qz"
copy /Y "%APPDATA%\qz\allowed.dat" "%PROGRAMDATA%\qz\allowed.dat" >nul
echo   Machine whitelist: %PROGRAMDATA%\qz\allowed.dat
set "SYSPROF=%WINDIR%\System32\config\systemprofile\AppData\Roaming\qz"
if not exist "%SYSPROF%" mkdir "%SYSPROF%" >nul 2>&1
if exist "%SYSPROF%" copy /Y "%APPDATA%\qz\allowed.dat" "%SYSPROF%\allowed.dat" >nul 2>&1
echo   SYSTEM whitelist : %SYSPROF%\allowed.dat
REM QZ expects the shared dir to be writable for graceful renewals.
icacls "%PROGRAMDATA%\qz" /grant "*S-1-5-32-545:(OI)(CI)M" >nul 2>&1
echo.

echo [6/6] Starting QZ Tray ...
start "" "%QZ_DIR%\qz-tray.exe"
timeout /t 5 /nobreak >nul
echo.

echo ============================================
echo   DONE
echo ============================================
echo.
echo   override.crt : %CERT_FILE%
echo   allowed.dat  : %PROGRAMDATA%\qz\allowed.dat
echo.
findstr /C:"4DBC25886175FDBADCFD734C7C9AE1BA5B9994F0" "%PROGRAMDATA%\qz\allowed.dat" >nul 2>&1
if "%errorlevel%"=="0" (
    echo   Fingerprint 4DBC...94F0 : FOUND in allowed.dat
) else (
    echo   Fingerprint 4DBC...94F0 : NOT FOUND - run debug-qz-cert to diagnose
)
echo.
echo   Next: restart the GustoPOS print agent, then do a test print.
echo   The QZ "Allow" dialog should NOT appear anymore.
echo.
pause
