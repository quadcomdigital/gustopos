#!/usr/bin/env bash
#
# gen-tenant-pki.sh — generate (or rotate) the QZ Tray signing PKI for ONE tenant.
#
# QZ Tray's trust model (qz/auth/Certificate.java):
#   * a CA placed in <QZ install dir>/override.crt is loaded once at startup and
#     becomes the trust anchor;
#   * every certificate that chains to that anchor is auto-approved and its
#     fingerprint is appended to allowed.dat — no dialog, no user interaction;
#   * a certificate that does NOT chain to an installed anchor is shown as
#     "Untrusted website" / "Invalid Certificate" and blocks silent printing.
#
# Giving each tenant its OWN root means the trust anchor itself is isolated: a
# leaf issued for tenant A is rejected by tenant B's POS machine, while the
# silent-printing behaviour is unchanged.
#
# Usage:
#   ./gen-tenant-pki.sh <slug> --domains test.example.it,example.it [options]
#
# Options:
#   --domains <a,b>   hosts this tenant is served from (required unless --rotate)
#   --cn <name>       leaf CN shown in the QZ dialog   (default: "GustoPOS <slug>")
#   --days <n>        leaf validity in days            (default: 730)
#   --root-days <n>   root validity in days            (default: 7300 ~20y)
#   --rotate          regenerate ONLY the leaf, recording the old fingerprint as
#                     renewal-of-<sha1> so QZ promotes it into allowed.dat
#                     automatically (Certificate.readRenewalInfo) — no dialog.
#   --force           regenerate the root too. Breaks every machine that already
#                     has the old override.crt installed (they need re-install).
#
# Output: certs/tenants/<slug>/
#   ca-key.pem            root private key        (0600, never leaves the server)
#   ca-cert.pem           root = override.crt     (public, installed on the POS)
#   private-key.pem        leaf private key        (0600, used by /signing/sign)
#   digital-certificate.pem leaf = digital-certificate.txt (public)
#   meta.json             domains/fingerprints/validity — the resolution map used
#                         by the signing routes to pick this tenant's material
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERTS_DIR="$(cd "$SCRIPT_DIR/../certs" && pwd)"
TENANTS_DIR="$CERTS_DIR/tenants"

usage() { sed -n '2,32p' "$0" | sed 's/^# \{0,1\}//'; }

SLUG=""
DOMAINS=""
CN=""
LEAF_DAYS=730
ROOT_DAYS=7300
ROTATE=0
FORCE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domains)   DOMAINS="${2:-}"; shift 2 ;;
    --domains=*) DOMAINS="${1#*=}"; shift ;;
    --cn)        CN="${2:-}"; shift 2 ;;
    --cn=*)      CN="${1#*=}"; shift ;;
    --days)      LEAF_DAYS="${2:-}"; shift 2 ;;
    --days=*)    LEAF_DAYS="${1#*=}"; shift ;;
    --root-days) ROOT_DAYS="${2:-}"; shift 2 ;;
    --root-days=*) ROOT_DAYS="${1#*=}"; shift ;;
    --rotate)    ROTATE=1; shift ;;
    --force)     FORCE=1; shift ;;
    -h|--help)   usage; exit 0 ;;
    -*)          echo "unknown option: $1" >&2; usage >&2; exit 2 ;;
    *)           SLUG="$1"; shift ;;
  esac
done

if [[ -z "$SLUG" ]]; then
  usage >&2
  exit 2
fi
if [[ ! "$SLUG" =~ ^[a-z0-9][a-z0-9-]*$ ]]; then
  echo "error: slug must match ^[a-z0-9][a-z0-9-]*$ (got '$SLUG')" >&2
  exit 2
fi

TENANT_DIR="$TENANTS_DIR/$SLUG"
CA_KEY="$TENANT_DIR/ca-key.pem"
CA_CERT="$TENANT_DIR/ca-cert.pem"
LEAF_KEY="$TENANT_DIR/private-key.pem"
LEAF_CERT="$TENANT_DIR/digital-certificate.pem"
META="$TENANT_DIR/meta.json"

CA_EXISTS=0
[[ -f "$CA_CERT" && -f "$CA_KEY" ]] && CA_EXISTS=1

if [[ $CA_EXISTS -eq 1 && $FORCE -eq 0 && $ROTATE -eq 0 && -f "$LEAF_CERT" && -f "$META" ]]; then
  echo "up-to-date: $TENANT_DIR (use --rotate for a new leaf, --force for a new root)"
  exit 0
fi

if [[ $ROTATE -eq 1 && $CA_EXISTS -eq 0 ]]; then
  echo "error: --rotate requested but no root in $TENANT_DIR" >&2
  exit 1
fi

# Domains are required when creating/forcing a root (they drive host→tenant
# resolution and the leaf SAN). --rotate keeps the recorded set unless given.
if [[ -z "$DOMAINS" && ( $FORCE -eq 1 || $CA_EXISTS -eq 0 ) ]]; then
  echo "error: --domains is required" >&2
  exit 2
fi

if [[ -z "$CN" && -f "$META" ]]; then
  # keep the CN shown in the QZ dialog stable across rotations
  CN="$(awk '/"cn"/{ sub(/.*"cn": *"/, ""); sub(/".*/, ""); print; exit }' "$META")"
fi
if [[ -z "$CN" ]]; then
  CN="GustoPOS $SLUG"
fi

mkdir -p "$TENANT_DIR"
umask 077

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# ── previous leaf (for the QZ "renewal-of" handover) ───────────────────────
PREV_FPR=""
if [[ -f "$META" ]]; then
  # the leaf fingerprint (second object in meta.json) — used for renewal-of
  PREV_FPR="$(awk '/"leaf"/{inleaf=1} inleaf && /fingerprintSha1/{
      sub(/.*"fingerprintSha1": *"/, ""); sub(/".*/, ""); print; exit }' "$META")"
  if [[ -z "$DOMAINS" ]]; then
    DOMAINS="$(awk '/"domains"/{
      line=$0; sub(/.*"domains": *\[/, "", line); sub(/\].*/, "", line);
      gsub(/"/, "", line); gsub(/ */, "", line); print line; exit }' "$META")"
  fi
fi

DOMAINS_SAN="$(echo "$DOMAINS" | tr ',' '\n' | sed '/^$/d' | sed 's/^/DNS:/' | paste -sd, -)"
if [[ -z "$DOMAINS_SAN" ]]; then
  DOMAINS_SAN="DNS:localhost"
fi

# ── root (per tenant — this becomes override.crt on that tenant's machines) ─
if [[ $CA_EXISTS -eq 0 || $FORCE -eq 1 ]]; then
  cat > "$WORK/ca.cnf" <<EOF
[req]
distinguished_name = req_dn
x509_extensions = v3_ca
prompt = no

[req_dn]
C = IT
ST = Rome
L = Rome
O = GustoPOS
CN = GustoPOS $SLUG CA

[v3_ca]
basicConstraints = critical, CA:TRUE
keyUsage = critical, keyCertSign, cRLSign
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid:always
EOF

  openssl req -x509 -newkey rsa:3072 -sha256 -days "$ROOT_DAYS" -nodes \
    -keyout "$CA_KEY" -out "$CA_CERT" \
    -config "$WORK/ca.cnf" -extensions v3_ca >/dev/null 2>&1
  chmod 600 "$CA_KEY"
  echo "root   : $CA_CERT"
fi

# ── leaf (the certificate QZ Tray receives and verifies signatures with) ───
SUBJECT="/C=IT/ST=Rome/L=Rome/O=GustoPOS/CN=$CN"
if [[ $ROTATE -eq 1 && -n "$PREV_FPR" ]]; then
  # QZ reads OID 2.5.4.13 (id-at-description) from the subject: when it starts
  # with "renewal-of-" and the listed fingerprint is already in allowed.dat,
  # the new certificate is whitelisted silently (qz/auth/Certificate.java).
  SUBJECT="$SUBJECT/2.5.4.13=renewal-of-$PREV_FPR"
fi

cat > "$WORK/leaf.cnf" <<EOF
[req]
distinguished_name = req_dn
prompt = no

[req_dn]
C = IT
ST = Rome
L = Rome
O = GustoPOS
CN = $CN

[v3_leaf]
basicConstraints = critical, CA:FALSE
keyUsage = critical, digitalSignature
extendedKeyUsage = serverAuth, clientAuth
subjectAltName = $DOMAINS_SAN
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid,issuer
EOF

openssl req -new -newkey rsa:2048 -sha256 -days "$LEAF_DAYS" -nodes \
  -keyout "$LEAF_KEY" -out "$WORK/leaf.csr" \
  -config "$WORK/leaf.cnf" \
  -subj "$SUBJECT" >/dev/null 2>&1

openssl x509 -req -in "$WORK/leaf.csr" -CA "$CA_CERT" -CAkey "$CA_KEY" \
  -CAcreateserial -CAserial "$TENANT_DIR/ca-cert.srl" \
  -days "$LEAF_DAYS" -sha256 \
  -extfile "$WORK/leaf.cnf" -extensions v3_leaf \
  -out "$LEAF_CERT" >/dev/null 2>&1
chmod 600 "$LEAF_KEY"

# keep a copy of the CSR next to the cert (audit trail / re-issue without re-key)
cp "$WORK/leaf.csr" "$TENANT_DIR/leaf.csr"
chmod 644 "$TENANT_DIR/leaf.csr"

# ── verify what we just produced — never ship an unverifiable chain ────────
if ! openssl verify -CAfile "$CA_CERT" "$LEAF_CERT" >/dev/null 2>&1; then
  echo "error: generated leaf does not verify against the tenant root" >&2
  exit 1
fi
CERT_MOD="$(openssl x509 -in "$LEAF_CERT" -noout -modulus)"
KEY_MOD="$(openssl rsa -in "$LEAF_KEY" -noout -modulus 2>/dev/null)"
if [[ "$CERT_MOD" != "$KEY_MOD" ]]; then
  echo "error: leaf private key does not match the leaf certificate" >&2
  exit 1
fi

fpr()   { openssl x509 -in "$1" -noout -fingerprint -sha1 | sed 's/^[^=]*=//;s/://g'; }
subj()  { openssl x509 -in "$1" -noout -subject | sed 's/^subject=//'; }
dates() { openssl x509 -in "$1" -noout -dates | sed -n "$2" | cut -d= -f2-; }

CA_FPR="$(fpr "$CA_CERT")"
LEAF_FPR="$(fpr "$LEAF_CERT")"
DOMAINS_JSON="$(echo "$DOMAINS" | tr ',' '\n' | sed '/^$/d' | sed 's/^/"/;s/$/"/' | paste -sd, -)"

cat > "$META" <<EOF
{
  "slug": "$SLUG",
  "cn": "$CN",
  "domains": [$DOMAINS_JSON],
  "generatedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "root": {
    "fingerprintSha1": "$CA_FPR",
    "subject": "$(subj "$CA_CERT")",
    "notBefore": "$(dates "$CA_CERT" 1p)",
    "notAfter": "$(dates "$CA_CERT" 2p)"
  },
  "leaf": {
    "fingerprintSha1": "$LEAF_FPR",
    "subject": "$(subj "$LEAF_CERT")",
    "notBefore": "$(dates "$LEAF_CERT" 1p)",
    "notAfter": "$(dates "$LEAF_CERT" 2p)",
    "renewalOf": "${PREV_FPR}"
  }
}
EOF
chmod 644 "$META" 2>/dev/null || true
chmod 644 "$CA_CERT" "$LEAF_CERT" 2>/dev/null || true

echo "slug   : $SLUG"
echo "domains: $DOMAINS"
echo "root   : SHA1 $CA_FPR  (install as override.crt on this tenant's machines)"
echo "leaf   : SHA1 $LEAF_FPR  (served as /signing/digital-certificate.txt)"
[[ -n "$PREV_FPR" && "$PREV_FPR" != "$LEAF_FPR" ]] && \
  echo "renewal: leaf carries renewal-of-$PREV_FPR (silent handover in QZ)"
echo "dir    : $TENANT_DIR"
