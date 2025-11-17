# API de Acordos Comerciais (`/api/v1/agreements`)

Este guia descreve como consumir as rotas de acordos comerciais recém modeladas no contrato OpenAPI disponível em `packages/contracts/openapi.yaml`. Os exemplos utilizam os tipos TypeScript gerados por `@ticketz/contracts` para manter o cliente alinhado ao que está documentado.

## Modo de armazenamento

- **Produção / dados reais**: por padrão, quando o serviço tem acesso a um banco configurado (`DATABASE_URL`), todas as operações persistem diretamente nas tabelas `agreements_*`. Falhas de schema ou permissões são propagadas para que o time de operações corrija a instância ao invés de ocultar o erro.
- **Catálogo demo (opcional)**: defina `AGREEMENTS_DEMO_MODE=true` apenas em ambientes de demonstração/local para servir os dados embarcados em memória. Nesse modo nenhuma escrita toca o banco e as rotas retornam exclusivamente o seed `config/demo-agreements.ts`.
- **Fallback automático**: foi removido; apenas o modo demo explícito usa mocks. Se o banco estiver indisponível e o modo demo não estiver habilitado, a API responderá com erro (`5xx`).

## Autenticação, rate limit e versionamento

- **Autenticação**: todas as rotas exigem o header `Authorization: Bearer <access-token>` emitido pelo LeadEngine. Chamadas sem credenciais válidas retornam `401` com o payload padrão `ErrorResponse`.
- **Rate limit**: as rotas herdam os limites globais da API (60 requisições/minuto por tenant). Quando o limite é atingido, o serviço responde com `429` e o header `Retry-After` indicando o tempo de espera em segundos.
- **Versionamento**: a versão está incorporada ao caminho (`/api/v1`). Sempre envie `Accept: application/json` e acompanhe o campo `version` presente em `meta` nas respostas para saber qual contrato está ativo.

## Estrutura dos envelopes (`data`/`meta`/`error`)

As respostas seguem o formato `{ data, meta }` em sucesso e `{ success: false, error }` em erro. Metadados expõem `requestId`, `generatedAt` e, nas listagens, informações de paginação e filtros aplicados. Erros reutilizam `ErrorResponse` e `ValidationErrorResponse` do contrato global.

## Listar acordos: `GET /api/v1/agreements`

Parâmetros de query aceitos:

- `page` (default `1`)
- `pageSize` (default `25`, máximo `200`)
- `status` (pode repetir o parâmetro para múltiplos valores, aceita `draft`, `active`, `suspended`, `terminated`, `archived`)
- `providerId` (filtra por integrações)
- `validOn` (ISO8601 UTC)
- `search` (texto livre)

Resposta de sucesso (`200`):

```json
{
  "data": [
    {
      "id": "agr_01hv5n9c6mcdx",
      "providerId": "leadengine",
      "externalCode": "LE-2025-01",
      "name": "Tabela padrão 2025",
      "status": "active",
      "version": 3,
      "validFrom": "2025-01-01T00:00:00Z",
      "validUntil": null,
      "tableCount": 2,
      "primaryCurrency": "BRL",
      "lastSyncedAt": "2025-02-20T01:15:00Z",
      "createdAt": "2023-10-12T11:21:00Z",
      "updatedAt": "2025-02-18T17:04:00Z"
    }
  ],
  "meta": {
    "requestId": "req_8caa6f08",
    "generatedAt": "2025-02-21T13:05:12Z",
    "version": "1.0.0",
    "pagination": {
      "page": 1,
      "pageSize": 25,
      "totalItems": 1,
      "totalPages": 1,
      "hasNext": false,
      "hasPrevious": false
    },
    "filters": {
      "statuses": ["active"],
      "providerIds": ["leadengine"],
      "validOn": "2025-02-21T00:00:00Z"
    }
  }
}
```

## Criar acordo: `POST /api/v1/agreements`

Envie um JSON com a chave `data` seguindo o schema `AgreementCreateRequest`. Exemplo mínimo:

```json
{
  "data": {
    "providerId": "leadengine",
    "name": "Tabela regional Nordeste",
    "status": "draft",
    "validFrom": "2025-03-01T00:00:00Z",
    "tables": [
      {
        "name": "WhatsApp Business",
        "currency": "BRL",
        "rates": [
          {
            "type": "flat",
            "value": 0.39,
            "currency": "BRL"
          }
        ],
        "windows": [
          {
            "label": "Comercial",
            "timezone": "America/Sao_Paulo",
            "daysOfWeek": ["monday", "tuesday", "wednesday", "thursday", "friday"],
            "startTime": "08:00",
            "endTime": "18:00"
          }
        ]
      }
    ]
  }
}
```

A resposta (`201`) retorna `AgreementResponse` com todas as tabelas, janelas e taxas já identificadas pelo serviço.

## Atualizar acordo: `PATCH /api/v1/agreements/{agreementId}`

O payload aceita apenas os campos que precisam mudar. Para publicar um rascunho e ajustar vigência:

```json
{
  "data": {
    "status": "active",
    "validFrom": "2025-03-01T12:00:00Z",
    "validUntil": null
  }
}
```

Conflitos de vigência ou versões simultâneas retornam `409` com detalhes no `error.details`.

## Importação em lote: `POST /api/v1/agreements/import`

- **`multipart/form-data`**: use o campo `file` (`.xlsx` ou `.csv`), além de `providerId`, `dryRun` (opcional) e `notifyEmails[]`.
- **`application/json`**: utilize `AgreementImportRequest` com uma lista de acordos estruturados.

A API responde `202` com `AgreementImportResponse`, contendo o `id` do job e contadores (`receivedAgreements`, `importedAgreements`, `skippedAgreements`). Consulte o job em workers internos ou dashboards operacionais.

## Sincronização com provedores: `POST /api/v1/agreements/providers/{providerId}/sync`

Aciona a integração externa e retorna `ProviderSyncStatus` (`queued`, `syncing`, `completed`, `failed`). É possível enviar `forceFullRefresh`, `correlationId` e `requestedBy` no corpo para rastreamento.

## Consumindo os tipos gerados

Depois de rodar `pnpm --filter @ticketz/contracts run generate`, importe os tipos no cliente:

```ts
import type { paths } from '@ticketz/contracts/types';

type ListAgreementsResponse = paths['/api/v1/agreements']['get']['responses']['200']['content']['application/json'];

type CreateAgreementRequest = paths['/api/v1/agreements']['post']['requestBody']['content']['application/json'];
```

Isso garante que o payload utilizado pelo frontend (ou outro consumidor) esteja sincronizado com o contrato, evitando regressões entre releases.
