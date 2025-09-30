# ============================================================================
# Multi-stage Dockerfile otimizado para Ticketz Web (React + Vite)
# ============================================================================

# Stage 1: Base com Node.js
FROM node:20-alpine AS base

# Instalar dependências do sistema
RUN apk add --no-cache \
    git \
    && rm -rf /var/cache/apk/*

# Instalar pnpm
RUN npm install -g pnpm@8

WORKDIR /app

# ============================================================================
# Stage 2: Build da aplicação
# ============================================================================
FROM base AS builder

# Copiar arquivos de configuração do workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.json tsconfig.base.json ./

# Copiar código-fonte dos packages compartilhados
COPY packages/core ./packages/core
COPY packages/shared ./packages/shared

# Copiar código-fonte do frontend
COPY apps/web ./apps/web

# Instalar dependências
RUN pnpm install --frozen-lockfile

# Build dos packages compartilhados primeiro
RUN pnpm --filter @ticketz/core build
RUN pnpm --filter @ticketz/shared build

# Build da aplicação web
RUN cd apps/web && pnpm build

# ============================================================================
# Stage 3: Nginx para servir arquivos estáticos
# ============================================================================
FROM nginx:1.25-alpine AS runtime

# Instalar dependências para healthcheck
RUN apk add --no-cache curl

# Copiar arquivos buildados
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# Criar configuração otimizada do nginx
RUN cat > /etc/nginx/conf.d/default.conf << 'EOF'
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Configurações de segurança
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Compressão
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/xml+rss
        application/json;

    # Cache para assets estáticos
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # Cache para HTML (sem cache para permitir atualizações)
    location ~* \.html$ {
        expires -1;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        try_files $uri =404;
    }

    # SPA routing - redirecionar tudo para index.html
    location / {
        try_files $uri $uri/ /index.html;
        expires -1;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
    }

    # API proxy (se necessário)
    location /api/ {
        proxy_pass http://api:4000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # WebSocket proxy para Socket.IO
    location /socket.io/ {
        proxy_pass http://api:4000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }

    # Logs
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log warn;
}
EOF

# Criar usuário não-root
RUN addgroup -g 1001 -S ticketz \
    && adduser -S -G ticketz -u 1001 ticketz

# Ajustar permissões
RUN chown -R ticketz:ticketz /usr/share/nginx/html \
    && chown -R ticketz:ticketz /var/cache/nginx \
    && chown -R ticketz:ticketz /var/log/nginx \
    && chown -R ticketz:ticketz /etc/nginx/conf.d \
    && touch /var/run/nginx.pid \
    && chown ticketz:ticketz /var/run/nginx.pid

# Mudar para usuário não-root
USER ticketz

# Expor porta
EXPOSE 80

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# Iniciar nginx
CMD ["nginx", "-g", "daemon off;"]
