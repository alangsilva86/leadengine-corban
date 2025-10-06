# Leads Inbox

Fluxo consumido pelos agentes após a conexão do WhatsApp.

1. `useLeadAllocations` -> GET `/api/lead-engine/allocations` + patch status.
2. `NoticeBanner` indica atualização automática a cada 15s (polling + socket fallback).
3. `useInboxLiveUpdates` (opcional) assina `leadengine:inbox:new` quando disponível via Socket.IO.
   - Prioriza WebSockets, mas força fallback para `polling` quando o ambiente bloqueia a conexão (ex.: Render sem suporte a WS).

## Contratos

- **GET** `/api/lead-engine/allocations?campaignId={id}` — lista leads alocados.
- **PATCH** `/api/lead-engine/allocations/:allocationId` — atualiza status/notas.
- **GET** `/api/lead-engine/allocations/export` — exporta CSV (mesmos filtros da listagem).
- **Socket Event (planejado)** `leadengine:inbox:new` — payload com `allocationId` / `campaignId` para disparar refresh otimista.

> Qualquer evolução no backend deve atualizar esta documentação para garantir a coesão front/back.
