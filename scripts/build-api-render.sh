#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

export PNPM_HOME="${PNPM_HOME:-$HOME/.local/share/pnpm}"
export PNPM_STORE_PATH="${PNPM_STORE_PATH:-$ROOT_DIR/.pnpm-store}"
export PATH="$PNPM_HOME:$PATH"

corepack enable
corepack prepare pnpm@9.12.3 --activate

pnpm fetch
pnpm -r install --frozen-lockfile --prod=false

pnpm run doctor

pnpm --filter @ticketz/api run build
