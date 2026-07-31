#!/usr/bin/env bash
#
# publish-downloads.sh — publish the gustopos-print-agent release binaries to
# the web app's public /downloads/ folder and regenerate:
#   - checksums.sha256     (sha256sum-style manifest)
#   - version.json         (machine-readable version + artifact metadata)
#   - index.html           (the public download page, served at /downloads/)
#
# Usage:
#   ./scripts/publish-downloads.sh [VERSION]
#
# Requires the release binaries to already exist in bin/ (run
# `make linux windows darwin` first). VERSION defaults to 0.2.0.
#
# NOTE: after publishing, rebuild the web app (`npm run build --workspace
# @gustopos/web`) so Vite copies public/downloads into dist/ for the API to
# serve.

set -euo pipefail

VERSION="${1:-0.2.0}"
AGENT="gustopos-print-agent"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BIN_DIR="$AGENT_DIR/bin"
WEB_PUBLIC="$(cd "$AGENT_DIR/../web/public" && pwd)"
DEST_DIR="$WEB_PUBLIC/downloads"
DEST_BIN="$DEST_DIR/bin"

if ! command -v sha256sum >/dev/null 2>&1; then
  echo "error: sha256sum not found" >&2
  exit 1
fi

if [[ ! -d "$BIN_DIR" ]] || ! ls "$BIN_DIR"/"$AGENT"-* >/dev/null 2>&1; then
  echo "error: no release binaries in $BIN_DIR — run 'make linux windows darwin' first" >&2
  exit 1
fi

# Guard: make sure the version passed here matches the version baked into the
# binaries by the Makefile (-X main.version). Prevents drift when the script is
# invoked directly with a stale/typo'd VERSION.
if [[ -x "$BIN_DIR/${AGENT}-linux-amd64" ]]; then
  embedded="$("$BIN_DIR/${AGENT}-linux-amd64" -version 2>/dev/null | awk '{print $NF}')"
  if [[ -n "$embedded" && "$embedded" != "$VERSION" ]]; then
    echo "error: VERSION '$VERSION' does not match the version baked into the binary ('$embedded'). Bump VERSION in the Makefile first." >&2
    exit 1
  fi
fi

# HTML-escape the version for the download page (it comes from the CLI arg).
VERSION_HTML="$(printf '%s' "$VERSION" | sed 's/&/\&amp;/g; s/</\&lt;/g; s/>/\&gt;/g')"

mkdir -p "$DEST_BIN"

# ── Copy binaries ──────────────────────────────────────────────────────────
echo "==> copying binaries to $DEST_BIN"
rm -f "$DEST_BIN"/"$AGENT"-*
for f in "$BIN_DIR"/"$AGENT"-*; do
  [[ -f "$f" ]] || continue
  cp -f "$f" "$DEST_BIN/$(basename "$f")"
  echo "    $(basename "$f")"
done

# ── Build checksums + artifact metadata ────────────────────────────────────
echo "==> generating checksums.sha256"
CHECKSUMS="$DEST_DIR/checksums.sha256"
: > "$CHECKSUMS"

declare -a ARTIFACTS=()
for f in "$DEST_BIN"/"$AGENT"-*; do
  [[ -f "$f" ]] || continue
  name="$(basename "$f")"
  sha="$(sha256sum "$f" | awk '{print $1}')"
  size="$(stat -c %s "$f")"
  printf '%s  %s\n' "$sha" "bin/$name" >> "$CHECKSUMS"
  ARTIFACTS+=("$name|$sha|$size")
done

# ── version.json ───────────────────────────────────────────────────────────
echo "==> generating version.json"
{
  printf '{\n'
  printf '  "app": "%s",\n' "$AGENT"
  printf '  "version": "%s",\n' "$VERSION"
  printf '  "generatedAt": "%s",\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf '  "artifacts": [\n'
  for i in "${!ARTIFACTS[@]}"; do
    IFS='|' read -r name sha size <<< "${ARTIFACTS[$i]}"
    if [[ $i -lt $((${#ARTIFACTS[@]} - 1)) ]]; then
      comma=","
    else
      comma=""
    fi
    printf '    { "file": "%s", "sha256": "%s", "size": %s }%s\n' "$name" "$sha" "$size" "$comma"
  done
  printf '  ]\n}\n'
} > "$DEST_DIR/version.json"

# ── index.html ─────────────────────────────────────────────────────────────
echo "==> generating index.html"

# Build OS-categorized download cards from the artifacts.
# name -> (label, arch, description)
declare -a ROWS=()
for i in "${!ARTIFACTS[@]}"; do
  IFS='|' read -r name sha size <<< "${ARTIFACTS[$i]}"
  human="$(printf '%d' "$size" | numfmt --to=iec 2>/dev/null || echo "${size}B")"
  case "$name" in
    *windows-amd64.exe) label="Windows"; arch="amd64 (x86_64)";;
    *linux-amd64)       label="Linux";   arch="amd64 (x86_64)";;
    *linux-arm64)       label="Linux";   arch="arm64 (aarch64)";;
    *darwin-amd64)      label="macOS";   arch="amd64 (Intel)";;
    *darwin-arm64)      label="macOS";   arch="arm64 (Apple Silicon)";;
    *)                  label="?";       arch="?";;
  esac
  ROWS+=("$label|$arch|$name|$sha|$human")
done

# Group by OS, preserving order: Windows, Linux, macOS.
cards=""
for os in Windows Linux macOS; do
  for row in "${ROWS[@]}"; do
    IFS='|' read -r label arch name sha human <<< "$row"
    [[ "$label" == "$os" ]] || continue
    cards+="<div class=\"card\">
  <div class=\"card-os\">$label</div>
  <div class=\"card-arch\">$arch</div>
  <a class=\"btn\" href=\"bin/$name\" download>Scarica <span class=\"fname\">$name</span></a>
  <div class=\"meta\">$human · sha256 <code>${sha:0:16}…</code></div>
</div>
"
  done
done

cat > "$DEST_DIR/index.html" <<EOF
<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>GustoPOS — Print Agent · Download v$VERSION_HTML</title>
<style>
  :root {
    --bg:#0f0f1a; --card:#1a1a2e; --card-hover:#20203a; --border:#33335a;
    --text:#e0e0f0; --muted:#8888aa; --green:#00ff88; --green-dim:#00c46a;
  }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
         background:var(--bg); color:var(--text); min-height:100vh; padding:40px 16px 60px; }
  .wrap { max-width:880px; margin:0 auto; }
  header { text-align:center; margin-bottom:36px; }
  .logo { font-size:13px; font-weight:700; letter-spacing:.14em; text-transform:uppercase;
          color:var(--muted); margin-bottom:14px; }
  h1 { font-size:26px; margin-bottom:10px; }
  .version { display:inline-block; background:rgba(0,255,136,.12); color:var(--green);
             border:1px solid rgba(0,255,136,.35); border-radius:999px; padding:4px 14px;
             font-size:13px; font-weight:600; }
  .sub { color:var(--muted); font-size:14px; margin-top:12px; line-height:1.6; }
  .sub code, .mono code { background:#101024; border:1px solid var(--border); border-radius:4px;
                          padding:1px 6px; font-size:12px; color:var(--green); }
  .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(250px,1fr)); gap:14px; }
  .card { background:var(--card); border:1px solid var(--border); border-radius:12px;
          padding:18px 16px; display:flex; flex-direction:column; gap:8px;
          transition:transform .15s ease, border-color .15s ease, background .15s ease; }
  .card:hover { transform:translateY(-2px); border-color:var(--green-dim); background:var(--card-hover); }
  .card-os { font-size:15px; font-weight:700; }
  .card-arch { color:var(--muted); font-size:13px; }
  .btn { margin-top:auto; text-align:center; background:var(--green); color:#000; font-weight:700;
         text-decoration:none; border-radius:8px; padding:10px 12px; font-size:13px;
         transition:background .15s ease; }
  .btn:hover { background:var(--green-dim); }
  .btn .fname { display:block; font-weight:500; font-size:11px; opacity:.75; margin-top:2px;
                word-break:break-all; }
  .meta { color:var(--muted); font-size:11px; }
  .meta code { color:var(--muted); }
  section { margin-top:36px; }
  h2 { font-size:16px; margin-bottom:12px; color:var(--green); }
  pre { background:#101024; border:1px solid var(--border); border-radius:8px; padding:14px;
        font-size:12px; line-height:1.6; overflow-x:auto; color:#c0c0dc; }
  details { background:var(--card); border:1px solid var(--border); border-radius:8px;
            padding:12px 14px; margin-bottom:10px; }
  summary { cursor:pointer; font-weight:600; font-size:13px; }
  details p, details pre { margin-top:10px; }
  details li { margin-left:18px; margin-top:4px; font-size:13px; color:var(--muted); }
  footer { margin-top:44px; text-align:center; color:var(--muted); font-size:12px; line-height:1.7; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="logo">GustoPOS · Print Agent</div>
    <h1>Scarica il Print Agent</h1>
    <div class="version">Versione $VERSION_HTML</div>
    <p class="sub">Installalo sul computer della cassa per connettere le stampanti
      a <strong>GustoPOS</strong>. Al primo avvio ti verrà mostrato un codice da inserire in
      <code>Settings → Configurazioni Stampa</code>. Richiede <strong>QZ Tray</strong> già installato.</p>
  </header>

  <div class="grid">
$cards  </div>

  <section>
    <h2>Installazione</h2>
    <details open>
      <summary>Windows</summary>
      <ol>
        <li>Scarica il file <code>…-windows-amd64.exe</code> e copialo dove preferisci (es. <code>C:\Program Files\GustoPOS</code>).</li>
        <li>Doppio clic sull'eseguibile: si aprirà nel browser la pagina di accoppiamento, già collegata al server GustoPOS.</li>
        <li>Inserisci il codice di 6 cifre mostrato in <strong>Settings → Configurazioni Stampa</strong> e premi <em>Collega</em>.</li>
        <li>Da quel momento l'agente si riconnette da solo: registra un'Attività pianificata all'accesso per l'avvio automatico.</li>
      </ol>
    </details>
    <details>
      <summary>Linux (systemd)</summary>
      <pre>make install &amp;&amp; make install-service
# verifica l'URL dell'API in /etc/systemd/system/gustopos-print-agent.service
systemctl start gustopos-print-agent</pre>
    </details>
    <details>
      <summary>macOS</summary>
      <ol>
        <li>Scarica il binario per la tua architettura (Intel o Apple Silicon).</li>
        <li>Rendilo eseguibile e avvialo dal Terminale: <code>chmod +x &amp;&amp; ./gustopos-print-agent-darwin-*</code>.</li>
        <li>macOS potrebbe chiedere conferma per un'app non firmata (Gatekeeper): fai clic su <em>Apri comunque</em>.</li>
      </ol>
    </details>
  </section>

  <section>
    <h2>Verifica integrità</h2>
    <p class="sub">Scarica anche <code>checksums.sha256</code> nella stessa cartella dei file e verifica:</p>
    <pre>sha256sum -c checksums.sha256</pre>
    <p class="sub">(esegui il comando nella cartella dove hai salvato binari + checksum)</p>
    <p class="sub">oppure, manualmente:</p>
    <pre>shasum -a 256 gustopos-print-agent-*</pre>
    <p class="sub">Manifesto completo: <a href="checksums.sha256" style="color:var(--green)">checksums.sha256</a> ·
       metadati: <a href="version.json" style="color:var(--green)">version.json</a></p>
  </section>

  <footer>
    GustoPOS Print Agent · v$VERSION_HTML · generato il $(date -u +%d/%m/%Y)<br>
    Per supporto: <a href="mailto:support@qzio.example" style="color:var(--green)">support</a>
  </footer>
</div>
</body>
</html>
EOF

echo "==> done. Published to $DEST_DIR"
echo "    Remember: npm run build --workspace @gustopos/web  (copies public/downloads into dist/)"
