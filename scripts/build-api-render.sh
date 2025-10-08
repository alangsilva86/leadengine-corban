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

pnpm -w prisma generate
pnpm --filter @ticketz/shared build
pnpm --filter @ticketz/core build
pnpm --filter @ticketz/storage build
pnpm --filter @ticketz/integrations build
pnpm --filter @ticketz/api build

pnpm prune --prod
