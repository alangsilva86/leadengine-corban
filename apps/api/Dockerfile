# ============================================================================
# Multi-stage Dockerfile otimizado para Ticketz API
# ============================================================================

# Stage 1: Base com dependências do sistema
FROM node:18-alpine AS base

# Instalar dependências do sistema necessárias
RUN apk add --no-cache \
    git \
    openssl \
    dumb-init \
    && rm -rf /var/cache/apk/*

# Instalar pnpm globalmente
RUN npm install -g pnpm@8

# Configurar usuário não-root
RUN addgroup -g 1001 -S nodejs \
    && adduser -S ticketz -u 1001 -G nodejs

WORKDIR /app

# ============================================================================
# Stage 2: Instalar dependências e build
# ============================================================================
FROM base AS builder

# Copiar arquivos de configuração do workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.json tsconfig.base.json ./

# Copiar configuração do Prisma
COPY prisma ./prisma

# Copiar código-fonte dos packages
COPY packages ./packages

# Copiar código-fonte da API
COPY apps/api ./apps/api

# Instalar todas as dependências (incluindo devDependencies para build)
RUN pnpm install --frozen-lockfile

# Gerar cliente Prisma
RUN cd apps/api && pnpm db:generate

# Build de todos os packages e da API
RUN pnpm -r build

# ============================================================================
# Stage 3: Preparar deployment (apenas dependências de produção)
# ============================================================================
FROM base AS deps

# Copiar arquivos de configuração
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.json tsconfig.base.json ./
COPY prisma ./prisma

# Copiar apenas os package.json dos packages necessários
COPY packages/core/package.json ./packages/core/
COPY packages/shared/package.json ./packages/shared/
COPY packages/storage/package.json ./packages/storage/
COPY packages/integrations/package.json ./packages/integrations/
COPY apps/api/package.json ./apps/api/

# Instalar apenas dependências de produção
RUN pnpm install --frozen-lockfile --prod

# Gerar cliente Prisma para produção
RUN cd apps/api && pnpm db:generate

# ============================================================================
# Stage 4: Runtime final
# ============================================================================
FROM base AS runtime

# Definir variáveis de ambiente
ENV NODE_ENV=production
ENV PORT=4000

WORKDIR /app

# Copiar dependências de produção
COPY --from=deps --chown=ticketz:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=ticketz:nodejs /app/apps/api/node_modules ./apps/api/node_modules

# Copiar código compilado da API
COPY --from=builder --chown=ticketz:nodejs /app/apps/api/dist ./dist

# Copiar código compilado dos packages
COPY --from=builder --chown=ticketz:nodejs /app/packages/core/dist ./packages/core/dist
COPY --from=builder --chown=ticketz:nodejs /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=ticketz:nodejs /app/packages/storage/dist ./packages/storage/dist
COPY --from=builder --chown=ticketz:nodejs /app/packages/integrations/dist ./packages/integrations/dist

# Copiar package.json necessários
COPY --from=builder --chown=ticketz:nodejs /app/apps/api/package.json ./package.json
COPY --from=builder --chown=ticketz:nodejs /app/packages/core/package.json ./packages/core/package.json
COPY --from=builder --chown=ticketz:nodejs /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder --chown=ticketz:nodejs /app/packages/storage/package.json ./packages/storage/package.json
COPY --from=builder --chown=ticketz:nodejs /app/packages/integrations/package.json ./packages/integrations/package.json

# Copiar schema do Prisma e cliente gerado
COPY --from=deps --chown=ticketz:nodejs /app/prisma ./prisma
COPY --from=deps --chown=ticketz:nodejs /app/node_modules/.prisma ./node_modules/.prisma

# Criar diretórios necessários
RUN mkdir -p logs sessions uploads \
    && chown -R ticketz:nodejs logs sessions uploads

# Mudar para usuário não-root
USER ticketz

# Expor porta
EXPOSE 4000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD node -e "require('http').get('http://localhost:4000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Usar dumb-init para gerenciamento de processos
ENTRYPOINT ["dumb-init", "--"]

# Comando de inicialização
CMD ["node", "dist/server.js"]
