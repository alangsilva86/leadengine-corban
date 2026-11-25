# syntax=docker/dockerfile:1
# ============================================================================
# API Ticketz LeadEngine — build a partir da raiz do monorepo:
#   docker build -f apps/api/Dockerfile -t ticketz-api .
# Alvos:
#   runtime (padrão)  imagem mínima, usuário não-root, `node dist/server.mjs`
#   migrate           workspace completo para `prisma migrate deploy` (one-off)
# ============================================================================

ARG NODE_VERSION=20.19.5

# ----------------------------------------------------------------------------
# base: Node + pnpm (versão do packageManager, via Corepack) + OpenSSL para o Prisma
# ----------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    COREPACK_HOME=/usr/local/share/corepack \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ENV PATH=$PNPM_HOME:$PATH
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate
WORKDIR /app

# ----------------------------------------------------------------------------
# build: dependências completas, cliente Prisma, libs do workspace e bundle da API
# ----------------------------------------------------------------------------
FROM base AS build
# Só o lockfile define o que é baixado: esta camada fica em cache até ele mudar.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm fetch --frozen-lockfile
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prefer-offline
RUN pnpm --filter @ticketz/storage run prisma:generate \
    && pnpm --filter "@ticketz/api^..." run build \
    && pnpm --filter @ticketz/api run build
# Pacote autocontido da API: dependências de produção (workspace incluso) + dist.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm --filter @ticketz/api deploy --prod /out \
    && rm -rf /out/dist && cp -R apps/api/dist /out/dist \
    && mkdir -p /out/prisma \
    && cp packages/storage/prisma/schema.prisma /out/prisma/schema.prisma \
    && cd /out \
    && /app/node_modules/.bin/prisma generate --schema prisma/schema.prisma \
    && rm -rf /out/src /out/test /out/logs /out/*.config.ts /out/tsconfig*.json /out/Dockerfile \
    && rm -f /out/dist/*.map

# ----------------------------------------------------------------------------
# migrate: `docker run --rm --env-file .env <img>` aplica as migrations pendentes
# ----------------------------------------------------------------------------
FROM build AS migrate
USER node
CMD ["pnpm", "run", "db:migrate:deploy"]

# ----------------------------------------------------------------------------
# runtime: só Node, dependências de produção e o bundle
# ----------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates dumb-init \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    PORT=4000 \
    POLL_METADATA_STORE_PATH=/app/data/poll-metadata.json
WORKDIR /app
COPY --from=build --chown=node:node /out ./
RUN mkdir -p logs data uploads && chown node:node logs data uploads
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||4000)+'/ready',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.mjs"]
