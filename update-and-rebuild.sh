#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== Update & Rebuild ==="

# 1. Update datasets (CPI, metals, crypto)
echo "Updating datasets..."
bash scripts/update.sh

# 2. Regenerate satsukashii prices
echo "Computing satsukashii prices..."
bun run scripts/compute-satsukashii.ts

# 3. Build site
echo "Building site..."
bun run build

echo "=== Update & Rebuild complete ==="

# O site e estatico e publicado pelo GitHub Pages no push para main
# (.github/workflows/deploy.yml). Nao ha etapa de deploy aqui: commite os
# datasets atualizados e o push publica.
