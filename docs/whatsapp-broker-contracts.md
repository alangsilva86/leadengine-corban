# WhatsApp Broker Contracts & Delivery Plan

## Inbound Contract

- Event envelope validated via `BrokerInboundEventSchema` (queue) and `BrokerWebhookInboundSchema` (webhook).
- Required fields: `id`, `type='MESSAGE_INBOUND'`, `instanceId`, and payload with `contact`, `message`, `metadata`.
- Timestamp handling: accepts ISO string or epoch (seconds/ms) and normalises to ISO before ingestion; cursor optional.
- Contact attributes downstream: `phone`, `name`, `document`, `registrations`, `avatarUrl`, `pushName` (all nullable); additional keys preserved via metadata if broker expands payload.
- Message object stays free-form but must be a JSON object; raw Baileys payload forwarded intact for normaliser/tests.

### Sample

```json
{
  "id": "wamid-123",
  "type": "MESSAGE_INBOUND",
  "instanceId": "instance-42",
  "timestamp": "2024-05-02T13:05:00.000Z",
  "payload": {
    "instanceId": "instance-42",
    "timestamp": "2024-05-02T13:05:00.000Z",
    "contact": {
      "phone": "+5511999999999",
      "name": "Maria",
      "registrations": ["ABC123"]
    },
    "message": {
      "conversation": "Oi!",
      "imageMessage": {
        "mimetype": "image/jpeg"
      }
    },
    "metadata": {
      "broker": "baileys",
      "timestamp": 1714655100
    }
  }
}
```

## Outbound Contract

- Requests validated with `BrokerOutboundMessageSchema` inside `whatsappBrokerClient.sendMessage`.
- Minimal required fields: `sessionId`/`instanceId`, `to`, `content`; `type` defaults to `text`.
- Media/template/location payloads optional but mandatory when `type != text`.
- Responses normalised via `BrokerOutboundResponseSchema`; `externalId` fallback maintained for idempotency.

### Allowed Types (prepped for future broker support)

- `text`
- `image`
- `video`
- `document`
- `audio`
- `location`
- `template`

## Timeline Reconciliacao (Semana 2)

1. **Persist timeline snapshot:** use `ticket.metadata.timeline` (filled by storage layer when messages are created) to recompute conversation stats without scanning history.
2. **Broker parity:** store broker timestamps (`metadata.brokerMessageTimestamp` && `normalizedTimestamp`) and reconcile with ticket timeline on poller replay to avoid duplicates.
3. **Backfill job:** schedule worker to iterate recent tickets and rebuild `timeline` metadata using stored message timestamps for legacy data.
4. **Socket payload:** extend `ticket.updated`/`ticket.message` events to embed `timeline` deltas so web inbox can update `firstInboundAt/lastInboundAt` without full refetch.

## Socket & Metricas Impacto

- **Socket:**
  - `ticket.message` -> include `metadata.broker` (ids + timestamps) and `metadata.media/location/contacts` for client reconciliation.
  - `whatsapp.queue.missing` already emitted when default queue absent; keep as guardrail for Ops dashboards.
  - New planned event: `whatsapp.timeline.reconciled` (tenant scope) after nightly reconciliation to notify analytics service.
- **Metrics:**
  - `whatsapp_webhook_events_total` now tagged by `result` (`accepted/ignored/rejected`) and `reason`; add `payload_type` when outbound events arrive.
  - Future Week 2 counters: processing latency (webhook → ingest) using received timestamp vs `Date.now()`.

## Upload API Sketch (Semana 2 Kick-off)

- **Route:** `POST /api/whatsapp/uploads`
  - Auth: tenant scoped token (same guard as ticket routes).
  - Body: multipart form (`file`, `type`, optional `caption`, `ticketId`, `contactId`).
  - Response: `{ uploadId, resourceUrl, expiresAt, mediaType, size }`.
- **Storage Provider:** abstraction in `apps/api/src/services/storage-provider.ts` with S3 (prod) + disk (dev) implementations; reuse configuration pattern from existing document uploads.
- **Broker Dispatch:** upon successful upload, broker message payload includes `media.url` pointing to signed URL + metadata (mimetype/size). Contract already covered by `BrokerOutboundMessageSchema.media`.
- **Lifecycle:**
  1. Client uploads file -> API stores, returns signed URL & temp metadata.
  2. Frontend triggers `sendMessage` with `type` inferred (`image`, `document`, etc.) referencing upload.
  3. Worker cleans up expired uploads (CRON 24h) if broker dispatch fails.
- **Security:** enforce size limits per mimetype, virus scan hook (placeholder) before generating signed URL, audit log entry referencing `uploadId` and tenant.

## Next Steps Checklist

- [ ] Implement outbound broker support for non-text types using the new contract.
- [ ] Wire reconciliation worker to consume `ticket.metadata.timeline` and broadcast socket updates.
- [ ] Expose Prometheus gauges for pipeline latency and dedupe hit rate.
- [ ] Finalise storage provider interface and create migration plan for existing media endpoints.
