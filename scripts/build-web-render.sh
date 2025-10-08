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

NODE_OPTIONS="--max-old-space-size=448" \
  pnpm -C apps/web exec vite build --config apps/web/vite.build.ci.mjs

pnpm prune --prod
