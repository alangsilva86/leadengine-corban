# Contratos de Eventos em Tempo Real

Esta nota descreve os eventos emitidos pelo Ticketz API para alimentar a Inbox de Leads e o painel de conversa em tempo real.

## tickets.updated

- **Salas**: `tenant:{tenantId}`, `ticket:{ticketId}`, `agreement:{agreementId}` (quando disponível).
- **Payload**:
  ```json
  {
    "tenantId": "tenant-1",
    "ticketId": "ticket-123",
    "agreementId": "agreement-9",
    "instanceId": "inst-42",
    "messageId": "msg-1",         // última mensagem que disparou o update
    "providerMessageId": "wamid.abc",
    "ticketStatus": "OPEN",
    "ticketUpdatedAt": "2024-06-01T12:00:00.000Z",
    "ticket": { ... }               // ticket Prisma serializado
  }
  ```
- **Uso**: atualizar listas/painéis sem refazer o fetch completo. O front pode invalidar caches com a chave do ticket ou mesclar incrementos.

## messages.new

- **Salas**: `tenant:{tenantId}`, `ticket:{ticketId}`, `agreement:{agreementId}` (quando disponível).
- **Payload**:
  ```json
  {
    "tenantId": "tenant-1",
    "ticketId": "ticket-123",
    "agreementId": "agreement-9",
    "instanceId": "inst-42",
    "messageId": "msg-1",
    "providerMessageId": "wamid.abc",
    "ticketStatus": "OPEN",
    "ticketUpdatedAt": "2024-06-01T12:00:00.000Z",
    "message": { ... }              // mensagem retornada por sendMessage
  }
  ```
- **Uso**: anexar a nova mensagem na thread aberta. O front deve deduplicar por `messageId` ou `providerMessageId`.

## Outros eventos mantidos por compatibilidade

- `ticket.updated`, `ticket.message`, `ticket.message.created`, `message:created` continuam sendo emitidos para clientes legados. O front novo deve priorizar os eventos documentados acima, mas pode manter handlers antigos como fallback.

## Métricas

Os eventos emitidos incrementam o contador `ws_emit_total` exposto em `/metrics` com os rótulos `event` e `room` para observabilidade.

## Checklist de consumo

1. Conectar ao Socket.IO com `withCredentials: true` e `path=/socket.io`.
2. Emitir `join-tenant`, `join-ticket` (e opcionalmente `join-agreement`).
3. Assinar `tickets.updated` e `messages.new` para atualizações em tempo real.
4. Se o socket cair, ativar o polling das rotas REST correspondentes.
