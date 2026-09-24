#!/bin/bash
#
# GustoPOS — QZ Tray certificate installer (Linux / macOS)
#
# GENERATED for tenant "{{SLUG}}" — do not edit. Re-download it from
# {{ORIGIN}}/signing/install-qz-cert.sh whenever the certificate rotates.
#
# Nothing is hardcoded: the CA, the leaf and their SHA-1 fingerprints come
# from the tenant's own origin and are pinned against the values published by
# the server, then the chain is verified with openssl before anything is
# written. QZ Tray (qz/auth/Certificate.java) only prints silently when the
# received certificate chains to a CA loaded from <install dir>/override.crt,
# so a wrong/missing override.crt is exactly what produces the
# "Untrusted website" / "Invalid Certificate" dialog.
#
set -euo pipefail

ORIGIN="{{ORIGIN}}"
TENANT="{{SLUG}}"
EXPECT_ROOT="{{ROOT_SHA1}}"
EXPECT_LEAF="{{LEAF_SHA1}}"
EXPECT_CN="{{CN}}"

step() { printf '[%s/6] %s\n' "$1" "$2"; }
ok()   { printf '       %s\n' "$1"; }
fail() { printf '\nFAILED: %s\n' "$1" >&2; exit 1; }

fingerprint() { openssl x509 -in "$1" -noout -fingerprint -sha1 | sed 's/^[^=]*=//;s/://g'; }

# QZ writes "yyyy-MM-dd HH:mm:ss" (UTC) into allowed.dat; the incoming value
# is openssl's "Sep 24 20:17:11 2026 GMT". Only the first tab-separated field
# is used to match, so a conversion failure is harmless — but try to be nice.
qz_date() {
  if date -u -d "$1" '+%Y-%m-%d %H:%M:%S' 2>/dev/null; then return 0; fi
  if date -u -j -f '%b %d %T %Y %Z' "$1" '+%Y-%m-%d %H:%M:%S' 2>/dev/null; then return 0; fi
  printf '1970-01-01 00:00:00'
}

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
CA_PEM="$WORK/override.crt"
LEAF_PEM="$WORK/digital-certificate.txt"

# ── 1. privileges ──────────────────────────────────────────────────────────
step 1 "Root check"
[ "$(id -u)" = "0" ] || fail "run it as root: sudo bash install-qz-cert.sh (the QZ Tray directory and the system-wide allowed.dat must be written)"
ok "running as root"

# ── 2. download + verify the tenant material ───────────────────────────────
step 2 "Downloading signing material from $ORIGIN"
command -v openssl >/dev/null 2>&1 || fail "openssl is required"
if command -v curl >/dev/null 2>&1; then
  download() { curl -fsSL --max-time 30 "$1" -o "$2"; }
else
  command -v wget >/dev/null 2>&1 || fail "curl or wget is required"
  download() { wget -q -T 30 -O "$2" "$1"; }
fi

download "$ORIGIN/signing/override.crt" "$CA_PEM" || fail "cannot download $ORIGIN/signing/override.crt"
download "$ORIGIN/signing/digital-certificate.txt" "$LEAF_PEM" || fail "cannot download $ORIGIN/signing/digital-certificate.txt"
grep -q "BEGIN CERTIFICATE" "$CA_PEM" || fail "$ORIGIN/signing/override.crt is not a PEM certificate"
grep -q "BEGIN CERTIFICATE" "$LEAF_PEM" || fail "$ORIGIN/signing/digital-certificate.txt is not a PEM certificate"

CA_SHA="$(fingerprint "$CA_PEM")"
LEAF_SHA="$(fingerprint "$LEAF_PEM")"
ok "override.crt  SHA1 $CA_SHA"
ok "certificate   SHA1 $LEAF_SHA"

[ "$CA_SHA" = "$EXPECT_ROOT" ] || fail "override.crt fingerprint mismatch (got $CA_SHA, server publishes $EXPECT_ROOT) — wrong origin or a rotation is pending"
[ "$LEAF_SHA" = "$EXPECT_LEAF" ] || fail "certificate fingerprint mismatch (got $LEAF_SHA, server publishes $EXPECT_LEAF)"

SUBJECT="$(openssl x509 -in "$LEAF_PEM" -noout -subject)"
case "$SUBJECT" in
  *"CN=$EXPECT_CN"*|*"CN = $EXPECT_CN"*) ;;
  *) fail "certificate subject is '$SUBJECT', expected CN=$EXPECT_CN" ;;
esac

openssl verify -CAfile "$CA_PEM" "$LEAF_PEM" >/dev/null 2>&1 \
  || fail "the published certificate does not chain to the published CA"
ok "chain verified: $SUBJECT"

# ── 3. locate QZ Tray ──────────────────────────────────────────────────────
step 3 "Locating QZ Tray"
if [ "$(uname)" = "Darwin" ]; then
  QZ_DIR="/Applications/QZ Tray.app/Contents/Resources"
  QZ_BIN="/Applications/QZ Tray.app/Contents/MacOS/QZ Tray"
  USER_ALLOW="$HOME/Library/Application Support/qz/allowed.dat"
  SHARED_ALLOW="/Library/Application Support/qz/allowed.dat"
  RESTART_CMD() { open -a "QZ Tray" >/dev/null 2>&1 || true; }
else
  QZ_DIR="/opt/qz-tray"
  QZ_BIN="/opt/qz-tray/qz-tray"
  [ -x "$QZ_BIN" ] || QZ_BIN="$(command -v qz-tray || true)"
  USER_ALLOW="$HOME/.qz/allowed.dat"
  SHARED_ALLOW="/srv/qz/allowed.dat"
  RESTART_CMD() { if [ -n "${QZ_BIN:-}" ]; then "$QZ_BIN" >/dev/null 2>&1 & fi; }
fi
[ -d "$QZ_DIR" ] || fail "QZ Tray not found in $QZ_DIR — install it from https://qz.io/download/ then re-run this script"
ok "$QZ_DIR"

# Stop QZ Tray. Match the process NAME exactly: `pkill -f qz-tray` matches any
# command line that merely mentions the path (the user's shell, this script's
# parent, a tail of the log) and would kill it too.
if [ "$(uname)" = "Darwin" ]; then
  pkill -x "QZ Tray" >/dev/null 2>&1 || true
else
  pkill -x qz-tray >/dev/null 2>&1 || true
fi
sleep 3

# ── 4. write override.crt (the tenant's trust anchor) ──────────────────────
step 4 "Installing override.crt"
cp "$CA_PEM" "$QZ_DIR/override.crt"
chmod 644 "$QZ_DIR/override.crt"
WRITTEN_SHA="$(fingerprint "$QZ_DIR/override.crt")"
[ "$WRITTEN_SHA" = "$EXPECT_ROOT" ] || fail "$QZ_DIR/override.crt does not contain the expected CA (got $WRITTEN_SHA)"
ok "$QZ_DIR/override.crt  SHA1 $EXPECT_ROOT"

# ── 5. whitelist the leaf so no dialog ever appears ────────────────────────
step 5 "Whitelisting the certificate"
LEAF_COPY="$WORK/gustopos-$TENANT-certificate.pem"
cp "$LEAF_PEM" "$LEAF_COPY"

# Preferred: ask QZ itself (writes the canonical allowed.dat line). As root it
# writes the system-wide file; the per-user copy is appended below either way.
if [ -n "${QZ_BIN:-}" ]; then
  "$QZ_BIN" --whitelist "$LEAF_COPY" >/dev/null 2>&1 || true
fi

# QZ Tray records the SHA-1 in allowed.dat in LOWERCASE
# (qz/utils/ByteUtilities.toHexString(digest, upperCase=false)) and matches it
# case-sensitively, so the line written below must be lowercase even though
# openssl prints the fingerprint uppercase.
LEAF_LC="$(printf '%s' "$LEAF_SHA" | tr 'A-F' 'a-f')"

CN_VALUE="$(openssl x509 -in "$LEAF_PEM" -noout -subject | sed -n 's/.*CN *= *\([^,]*\).*/\1/p')"
OR_VALUE="$(openssl x509 -in "$LEAF_PEM" -noout -subject | sed -n 's/.*O *= *\([^,]*\).*/\1/p')"
NOT_BEFORE="$(qz_date "$(openssl x509 -in "$LEAF_PEM" -noout -startdate | cut -d= -f2-)")"
NOT_AFTER="$(qz_date "$(openssl x509 -in "$LEAF_PEM" -noout -enddate | cut -d= -f2-)")"
LINE="$(printf '%s\t%s\t%s\t%s\t%s\tTrue' "$LEAF_LC" "$CN_VALUE" "$OR_VALUE" "$NOT_BEFORE" "$NOT_AFTER")"

append_allow() {
  local file="$1" dir
  dir="$(dirname "$file")"
  mkdir -p "$dir"
  touch "$file"
  if ! grep -qi "$LEAF_LC" "$file" 2>/dev/null; then
    printf '%s\n' "$LINE" >> "$file"
  fi
  chmod 666 "$file" 2>/dev/null || true
  chmod 1777 "$dir" 2>/dev/null || true
  ok "$file"
}

append_allow "$USER_ALLOW"
append_allow "$SHARED_ALLOW"

# ── 6. restart QZ Tray ─────────────────────────────────────────────────────
step 6 "Restarting QZ Tray"
RESTART_CMD
sleep 3

echo
echo "DONE — tenant '$TENANT'"
echo "  override.crt : $QZ_DIR/override.crt (SHA1 $EXPECT_ROOT)"
echo "  certificate  : SHA1 $EXPECT_LEAF (CN=$EXPECT_CN)"
echo
echo "  Next: restart the GustoPOS print agent, then print a test ticket."
echo "  No QZ Tray dialog should appear."
echo "  If anything still fails, run the diagnostics:"
echo "    https://<this-origin>/signing/debug-qz-cert.ps1   (Windows)"
echo "    or the agent's dashboard: http://127.0.0.1:8183"
echo
exit 0
