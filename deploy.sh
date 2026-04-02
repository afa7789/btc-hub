#!/bin/bash
set -euo pipefail

# --- Configuration ---
SSH_KEY_PATH="${SSH_KEY_PATH:-~/.ssh/id_rsa}"
VPS_USER="${VPS_USER:-deploy}"
VPS_HOST="${VPS_HOST:-btc-things.example.com}"
VPS_PATH="${VPS_PATH:-/var/www/btc-things}"
# ---------------------

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DIST_DIR="$SCRIPT_DIR/dist"

echo "=== BTC Things Deploy ==="

# Check if dist exists
if [ ! -d "$DIST_DIR" ]; then
    echo "Error: dist/ directory not found. Run 'bun run build' (or 'npm run build') first."
    exit 1
fi

# Deploy via rsync
echo "Deploying to ${VPS_USER}@${VPS_HOST}:${VPS_PATH}..."
rsync -avz --delete \
    -e "ssh -i ${SSH_KEY_PATH}" \
    "$DIST_DIR/" \
    "${VPS_USER}@${VPS_HOST}:${VPS_PATH}/"

echo "=== Deploy complete ==="
