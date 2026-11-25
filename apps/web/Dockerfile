# syntax=docker/dockerfile:1
# ============================================================================
# Frontend Ticketz LeadEngine (React + Vite) servido por nginx não-root.
#   docker build -f apps/web/Dockerfile -t ticketz-web \
#     --build-arg VITE_API_URL=https://api.exemplo.com --build-arg VITE_WS_URL=wss://api.exemplo.com .
# As variáveis VITE_* são lidas no BUILD (ficam no bundle); definir no runtime não tem efeito.
# Sem VITE_API_URL o app usa a mesma origem e o nginx encaminha /api e /socket.io
# para API_UPSTREAM (padrão http://api:4000, resolvido no momento da requisição).
# ============================================================================

ARG NODE_VERSION=22.22.2

# ----------------------------------------------------------------------------
# build: workspace instalado pelo lockfile e bundle estático do Vite
# ----------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS build
ENV PNPM_HOME=/pnpm \
    COREPACK_HOME=/usr/local/share/corepack \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm fetch --frozen-lockfile
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prefer-offline
ARG VITE_API_URL
ARG VITE_WS_URL
ARG VITE_AUTH_PROVIDER
ARG VITE_DEFAULT_TENANT_HINT
ARG VITE_AUTH_PREFILL_EMAIL
ARG VITE_AUTH_PREFILL_PASSWORD
RUN pnpm --filter "web^..." run build \
    && pnpm --filter web run build \
    && test -f apps/web/dist/index.html

# ----------------------------------------------------------------------------
# runtime: nginx sem root (uid 101), porta 8080
# ----------------------------------------------------------------------------
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
ENV API_UPSTREAM=http://api:4000 \
    NGINX_RESOLVER=127.0.0.11
COPY <<'EOF' /etc/nginx/templates/default.conf.template
server {
    listen 8080;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json image/svg+xml;

    # Resolução tardia: o nginx sobe mesmo quando a API ainda não existe na rede.
    resolver ${NGINX_RESOLVER} valid=30s ipv6=off;
    set $api_upstream ${API_UPSTREAM};

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|webp|avif)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    location ~* \.html$ {
        expires -1;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        try_files $uri =404;
    }

    location / {
        try_files $uri $uri/ /index.html;
        expires -1;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    location ^~ /api/ {
        proxy_pass $api_upstream;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }

    location ^~ /socket.io/ {
        proxy_pass $api_upstream;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }

    location = /health {
        access_log off;
        add_header Content-Type text/plain;
        return 200 "healthy\n";
    }
}
EOF
COPY --from=build --chown=101:101 /app/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/health || exit 1
