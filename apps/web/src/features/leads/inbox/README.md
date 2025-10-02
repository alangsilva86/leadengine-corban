# Leads Inbox

Fluxo consumido pelos agentes após a conexão do WhatsApp.

1. `useLeadAllocations` -> GET `/api/lead-engine/allocations` + patch status.
2. `NoticeBanner` indica atualização automática a cada 15s (polling + socket fallback).
3. `useInboxLiveUpdates` (opcional) assina `leadengine:inbox:new` quando disponível via Socket.IO.

## Contratos

- **GET** `/api/lead-engine/allocations?campaignId={id}` — lista leads alocados.
- **PATCH** `/api/lead-engine/allocations/:allocationId` — atualiza status/notas.
- **GET** `/api/lead-engine/allocations/export` — exporta CSV (mesmos filtros da listagem).
- **Socket Event (planejado)** `leadengine:inbox:new` — payload com `allocationId` / `campaignId` para disparar refresh otimista.

> Qualquer evolução no backend deve atualizar esta documentação e os testes em `__tests__/LeadInbox.test.jsx` para garantir a coesão front/back.
