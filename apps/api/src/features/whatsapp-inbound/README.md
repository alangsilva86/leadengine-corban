# WhatsApp Inbound Pipeline

```
Cliente → POST /api/webhooks/whatsapp → [routes/webhook-routes]
        → enqueueWhatsAppBrokerEvents → [queue/event-queue]
        → whatsappInboundProcessor (workers/inbound-processor)
        → ingestInboundWhatsAppMessage (services/inbound-lead-service)
        → addAllocations → Socket/Event (futuro) → Inbox (apps/web)
```

- **routes/** cuida da validação de assinatura e da normalização dos eventos recebidos via webhook.
- **queue/** concentra a fila interna utilizada para desacoplar o webhook do restante do pipeline.
- **workers/** mantém o *processor* que transforma eventos em leads e coordena retentativas da fila.
- **services/** contém regras de negócio (normalização, dedupe, criação de allocations).

> Co-locamos documentação e código para facilitar evoluções de UX (confirmations, automações) sem quebrar o contrato técnico.

### Referências

- `docs/whatsapp-broker-contracts.md` consolida contratos broker, plano de reconciliação de timeline e desenho inicial da API de upload.
