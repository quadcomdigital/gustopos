#!/usr/bin/env bash
# Bootstraps the image tooling (`sharp` + `png-to-ico`) into a throwaway cache
# directory and runs the asset generator. Nothing is added to package.json or
# package-lock.json — the cache lives outside the repo.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOOLS_DIR="${OMNI_ASSETS_TOOLS_DIR:-${TMPDIR:-/tmp}/omni-assets-tools}"

mkdir -p "$TOOLS_DIR"
if [ ! -d "$TOOLS_DIR/node_modules/sharp" ] || [ ! -d "$TOOLS_DIR/node_modules/png-to-ico" ]; then
  echo "[assets] installing sharp + png-to-ico into $TOOLS_DIR"
  (cd "$TOOLS_DIR" && [ -f package.json ] || npm init -y >/dev/null 2>&1)
  npm install --prefix "$TOOLS_DIR" --no-save --no-audit --no-fund sharp png-to-ico >/dev/null
fi

NODE_PATH="$TOOLS_DIR/node_modules${NODE_PATH:+:$NODE_PATH}" node "$SCRIPT_DIR/generate-assets.mjs"
