# WhatsApp Inbound Pipeline

```
Cliente → POST /api/webhooks/whatsapp → [routes/webhook-routes]
        → ingestInboundWhatsAppMessage (services/inbound-lead-service)
        → addAllocations → Socket/Event (futuro) → Inbox (apps/web)
```

- **routes/** cuida da validação de assinatura e da normalização dos eventos recebidos via webhook.
- **services/** contém regras de negócio (normalização, dedupe, criação de allocations).
- **utils/** mantém funções auxiliares para logging/diagnósticos do broker.

> Co-locamos documentação e código para facilitar evoluções de UX (confirmations, automações) sem quebrar o contrato técnico.

### Referências

- `docs/whatsapp-broker-contracts.md` consolida contratos broker, plano de reconciliação de timeline e desenho inicial da API de upload.
