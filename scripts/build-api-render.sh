#!/usr/bin/env bash
set -euo pipefail

export CI=true
export ESBUILD_WORKER_THREADS=1
export ROLLUP_MAX_PARALLEL=1
export TSUP_DTS=false
export TSUP_SOURCEMAP=false
export TSUP_MINIFY=true

pnpm i --frozen-lockfile

export NODE_ENV=production

pnpm --filter @ticketz/storage run prisma:generate
pnpm --filter @ticketz/shared build
pnpm --filter @ticketz/core build
pnpm --filter @ticketz/storage build
pnpm --filter @ticketz/integrations build
pnpm --filter @ticketz/api build

pnpm prune --prod
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
