#!/bin/bash
echo "============================================"
echo "  GustoPOS QZ Tray Certificate Installer"
echo "============================================"
echo ""

# Embedded base64 certificate (no network needed)
CERT_B64="LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSURlRENDQW1DZ0F3SUJBZ0lVV1dEakpNd3FSYUFlb0lTVXFHd3VFcGZObmVjd0RRWUpLb1pJaHZjTkFRRUwKQlFBd1ZERUxNQWtHQTFVRUJoTUNTVlF4RFRBTEJnTlZCQWdNQkZKdmJXVXhEVEFMQmdOVkJBY01CRkp2YldVeApFVEFQQmdOVkJBb01DRWQxYzNSdlVFOVRNUlF3RWdZRFZRUUREQXRIZFhOMGIxQlBVeUJEUVRBZUZ3MHlOakEzCk1qSXlNalF6TXpWYUZ3MHpOakEzTVRreU1qUXpNelZhTUZReEN6QUpCZ05WQkFZVEFrbFVNUTB3Q3dZRFZRUUkKREFSU2IyMWxNUTB3Q3dZRFZRUUhEQVJTYjIxbE1SRXdEd1lEVlFRS0RBaEhkWE4wYjFCUFV6RVVNQklHQTFVRQpBd3dMUjNWemRHOVFUMU1nUTBFd2dnRWlNQTBHQ1NxR1NJYjNEUUVCQVFVQUE0SUJEd0F3Z2dFS0FvSUJBUUN1CnphUVRONms1c2M3ZzU2UVVCWWRubmZhalZpR3dDR0dZcURwUFNyTVo0MVBkRFo2dS9icHozeE9mTHhhTGZJMmYKUzFwR0JQSy84QllUMlVDamo2RlR3NkVFS3ZaOWhXUVhvckxOSjJpVDNQTTZKTXFzOVRwMVNjeXh4MEpicDdCLwpTa25GRnM0UUxJUnpZQUYrZ3RkOTIyeUhtYm04bWlsSUc1Y2p5N0xmaHlIclNaMlQ2ZTNrc2VmdTFBUVJzWEhvClR6N2FtUDNVQlQvNW5NaWVHRXF1dkI1cWhUeGh5SG9sdHVRcEhYcW1rRUdxNG9MUXBkUk8wUkpWZlR1eFBvdm0KRXk5Z3RzZlVrejVuUDNEeGJMYzlhT3N6cjRzOGxGV0krSnZ0Tmd2U0IvUDJ0S2xUUkV4cTYwSklBRTFZU0tDcwp0aVM1RUFnY0RBcHNLV2lkOVIvckFnTUJBQUdqUWpCQU1BOEdBMVVkRXdFQi93UUZNQU1CQWY4d0RnWURWUjBQCkFRSC9CQVFEQWdFR01CMEdBMVVkRGdRV0JCUjJuNDhDOVlZN3ZUOG4xMGpOQmxJcTJvMDNpREFOQmdrcWhraUcKOXcwQkFRc0ZBQU9DQVFFQU14dldoOFJaMEd0d2JZV2tUeURQL2pnbG9JRThNa0wwL1BtTE1zY0RWUHc5cnpZcgpybGlBZEhBaXFlZnBIMTU3MkcwTU1NTHZqNEp2d045aFNTMTF0T3pGWTNEakdjRnhiajJURkZya2NFWEN5WjJhCmFXdU1GdkREU1dlazljVnBHVVJFcDh5aUppRll2TjE5d2hXZXIzb3FRS2hwQit2V0NGL2FKRFozTWdjYnk3WlkKQ3NJT1VIejlRVlBSYVp5WUE2aWoyazFOemY5VHlQQkExYXE4RFR3QTgzQ05pdFpBVzgrRThzd284aWFFeEZyUgpXQWRjaGtuQVlQWDRxWHZSQ0Y3cFVyZDFNcjV5bTNpUHN1V3dtK3J4NzRaK0lhZDlTU0RPRGJ3RGNaRWFOa290CjZIV1pkb21ob2VUY3VsaHNWUm9FcWFZT0c3SHpJNitWWjFxNEd3PT0KLS0tLS1FTkQgQ0VSVElGSUNBVEUtLS0tLQo="

# ============================================================
# Step 1: Stop QZ Tray
# ============================================================
echo "[1/4] Stopping QZ Tray ..."
pkill -f "qz-tray" 2>/dev/null
sleep 3
echo "  Done."

# ============================================================
# Step 2: Find QZ Tray directory
# ============================================================
echo ""
echo "[2/4] Finding QZ Tray ..."

QZ_DIR=""
if [ "$(uname)" = "Darwin" ]; then
    if [ -d "/Applications/QZ Tray.app/Contents/Resources" ]; then
        QZ_DIR="/Applications/QZ Tray.app/Contents/Resources"
    fi
else
    if [ -d "/opt/qz-tray" ]; then
        QZ_DIR="/opt/qz-tray"
    fi
fi

if [ -z "$QZ_DIR" ]; then
    echo "  ERROR: QZ Tray not found!"
    echo "  Please install QZ Tray from https://qz.io/download/"
    exit 1
fi
echo "  Found: $QZ_DIR"

# ============================================================
# Step 3: Write override.crt directly (embedded, no download)
# ============================================================
echo ""
echo "[3/4] Installing certificate ..."

CERT_FILE="$QZ_DIR/override.crt"
echo "$CERT_B64" | base64 -d > "$CERT_FILE" 2>/dev/null

if [ -f "$CERT_FILE" ]; then
    if grep -q "GustoPOS" "$CERT_FILE" 2>/dev/null; then
        echo "  VERIFIED: override.crt contains GustoPOS CA"
    else
        echo "  WARNING: File may contain wrong content"
    fi
else
    echo "  ERROR: Failed to write certificate!"
    exit 1
fi

# ============================================================
# Step 4: Update whitelist and restart
# ============================================================
echo ""
echo "[4/4] Updating whitelist ..."

if [ "$(uname)" = "Darwin" ]; then
    QZ_DATA="$HOME/Library/Application Support/qz"
else
    QZ_DATA="$HOME/.qz"
fi

mkdir -p "$QZ_DATA"
ALLOW_FILE="$QZ_DATA/allowed.dat"
touch "$ALLOW_FILE"

# Remove old entries
if grep -q "B710176029C2378A4886B22E5D0874A7A4305FBA" "$ALLOW_FILE" 2>/dev/null; then
    grep -v "B710176029C2378A4886B22E5D0874A7A4305FBA" "$ALLOW_FILE" > "${ALLOW_FILE}.tmp" 2>/dev/null
    mv "${ALLOW_FILE}.tmp" "$ALLOW_FILE" 2>/dev/null
fi
if grep -q "F4E2BF9339DBF7A80EBCDEB1071FEFB0E47FED4C" "$ALLOW_FILE" 2>/dev/null; then
    grep -v "F4E2BF9339DBF7A80EBCDEB1071FEFB0E47FED4C" "$ALLOW_FILE" > "${ALLOW_FILE}.tmp" 2>/dev/null
    mv "${ALLOW_FILE}.tmp" "$ALLOW_FILE" 2>/dev/null
fi

# Add new entry (hardcoded)
printf "F4E2BF9339DBF7A80EBCDEB1071FEFB0E47FED4C\ttest.franksbar.it\tGustoPOS\tJul 22 22:43:36 2026 GMT\tJul 19 22:43:36 2036 GMT\tTrue\n" >> "$ALLOW_FILE"
echo "  Whitelist updated"

# Verify
if grep -q "F4E2BF9339DBF7A80EBCDEB1071FEFB0E47FED4C" "$ALLOW_FILE" 2>/dev/null; then
    echo "  VERIFIED: Fingerprint in whitelist"
fi

# Start QZ Tray
echo ""
echo "Starting QZ Tray..."
if [ "$(uname)" = "Darwin" ]; then
    open -a "QZ Tray" 2>/dev/null
elif command -v qz-tray &> /dev/null; then
    qz-tray &
else
    echo "  Please start QZ Tray manually."
fi

sleep 3

echo ""
echo "============================================"
echo "  DONE! No network needed - cert was embedded."
echo ""
echo "  Open https://test.franksbar.it/print-station"
echo "  Click Connect - no dialogs should appear."
echo ""
echo "  Verify in debug.log:"
echo "    'Adding CA certificate: CN=GustoPOS CA'"
echo "============================================"
