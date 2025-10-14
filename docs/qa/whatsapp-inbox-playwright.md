# Smoke Playwright – Inbox por Instância

Este teste automatizado garante que a geração de inbox por `instanceId` responde corretamente após o enfileiramento de uma mensagem inbound via broker stub.

## Pré-requisitos

- Node.js >= 20.19 (alinhado com `.nvmrc`).
- pnpm 9.12.x (`corepack enable`).
- Browsers Playwright instalados (`pnpm exec playwright install chromium`).
- Dependências de sistema para Chromium (`pnpm exec playwright install-deps` em ambientes baseados em Ubuntu/Debian).

## Como executar

```bash
# Instale dependências e browsers
pnpm install
pnpm exec playwright install chromium
pnpm exec playwright install-deps   # necessário apenas em devcontainers/CI baseados em Ubuntu

# Rode o smoke test
pnpm test:playwright
```

O teste inicia um stub HTTP local que simula o broker, cria uma instância, envia uma mensagem e valida a lista de alocações retornada por `GET /api/lead-engine/allocations?instanceId=...`.
