# WhatsApp Render Shell cURL Recipes

These snippets help operators validate the WhatsApp webhook (inbound) and outbound delivery flows directly from a Render shell session.

## Prerequisites

1. Open the shell for the API service in Render.
2. Export the environment variables that mirror the deployment secrets:

```bash
export API_URL="https://leadengine-corban.onrender.com"            # or the environment specific host
export WHATSAPP_WEBHOOK_API_KEY="$(cat /etc/secrets/whatsapp_webhook_api_key)"  # adjust path if secrets differ
export TENANT_ID="demo-tenant"                                     # tenant served by the MVP bypass
export INSTANCE_ID="alan"                                          # WhatsApp instance bound to the tenant
# Optional: only needed if MVP auth bypass is disabled
# export AUTH_TOKEN="<jwt-token>"
```

> ℹ️ When `MVP_AUTH_BYPASS=true` (explicitly enabled in demos), the API automatically injects the bypass user and you do **not** need the `Authorization` header. In production environments keep the header enabled.

## Inbound webhook check

Trigger the webhook ingestion with a representative WhatsApp event:

```bash
curl -X POST "$API_URL/api/integrations/whatsapp/webhook" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $WHATSAPP_WEBHOOK_API_KEY" \
  -d '{
    "events": [
      {
        "id": "wamid-123",
        "instanceId": "${INSTANCE_ID}",
        "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
        "type": "MESSAGE_INBOUND",
        "from": {
          "phone": "+5511999999999",
          "name": "Maria",
          "pushName": "Maria C.",
          "registrations": ["ABC123"]
        },
        "message": {
          "id": "wamid-123",
          "conversation": "Oi!",
          "type": "text"
        },
        "metadata": {
          "broker": "baileys",
          "source": "render-shell"
        }
      }
    ]
  }'
```

A successful request returns `{ "ok": true }`. You can tail the worker logs to confirm the event was enqueued and processed:

```bash
tail -n 200 -f logs/api/current | rg "whatsapp"
```

## Outbound message check

Dispatch an outbound text message for the same tenant:

```bash
curl -X POST "$API_URL/api/integrations/whatsapp/instances/$INSTANCE_ID/messages" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TENANT_ID" \
  ${AUTH_TOKEN:+-H "Authorization: Bearer $AUTH_TOKEN"} \
  -d '{
    "to": "+5511999999999",
    "payload": {
      "type": "text",
      "text": "Mensagem de teste enviada do Render shell"
    },
    "idempotencyKey": "render-shell-test-$(date +%s)"
  }'
```

A successful response returns HTTP `202` with the enqueue confirmation. Inspect the payload to verify the broker metadata (`status`/`ack`) captured on the message record.

> 💡 Need to test media or template flows? Replace the body with the payload documented in `docs/whatsapp-broker-contracts.md` while keeping the same headers.

## Raw `messages.upsert` fallback

When the `WHATSAPP_RAW_FALLBACK_ENABLED` feature flag is enabled, the webhook accepts Baileys `WHATSAPP_MESSAGES_UPSERT` events and locally converts them into `MESSAGE_INBOUND`. Use the snippet below to emulate the broker sending a raw payload:

```bash
curl -X POST "$API_URL/api/integrations/whatsapp/webhook" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $WHATSAPP_WEBHOOK_API_KEY" \
  -d '{
    "event": "WHATSAPP_MESSAGES_UPSERT",
    "iid": "'"$INSTANCE_ID"'",
    "payload": {
      "instanceId": "'"$INSTANCE_ID"'",
      "tenantId": "'"$TENANT_ID"'",
      "owner": "server",
      "type": "notify",
      "timestamp": '"$(date +%s)"',
      "messages": [
        {
          "key": {
            "id": "wamid-raw-'"$(date +%s)"'",
            "remoteJid": "5511999999999@s.whatsapp.net",
            "fromMe": false
          },
          "pushName": "Maria",
          "messageTimestamp": '"$(date +%s)"',
          "message": {
            "conversation": "Mensagem enviada via fallback raw"
          }
        }
      ]
    }
  }'
```

The API replies with HTTP `202` when at least one message is normalized. Check the worker logs (`tail -n 200 -f logs/api/current | rg "raw_inbound_normalized"`) to confirm the fallback was triggered and the broker metadata was appended to the queue event.

## Automated smoke test

Need to validate the full webhook → socket → UI flow quickly? Use the bundled smoke runner:

```bash
API_URL="https://leadengine-corban.onrender.com" \
WHATSAPP_WEBHOOK_API_KEY="$(cat /etc/secrets/whatsapp_webhook_api_key)" \
TENANT_ID="demo-tenant" \
INSTANCE_ID="alan" \
pnpm test:whatsapp
```

The script:

- envia um inbound de texto com IDs únicos;
- aguarda o evento `messages.new` no Socket.IO (`join-tenant`);
- resolve automaticamente o ticket via `GET /api/tickets?search=<telefone>`; e
- confirma que a mensagem aparece via `GET /api/tickets/:id/messages`.

Se qualquer etapa falhar, o processo encerra com código ≠ 0 e imprime o motivo (webhook, socket ou persistência).

## Troubleshooting tips

- **401 responses** usually mean the API key or auth token is missing. Double-check the headers exported above.
- **503 responses** point to broker connectivity problems. Re-run `curl "$API_URL/healthz"` and inspect the API logs for `whatsapp` errors.
- **Message queued but not delivered?** Verify the instance connection via `curl "$API_URL/api/integrations/whatsapp/instances/$INSTANCE_ID/status"` and reconnect if needed.

## QA checklist – raw fallback

1. **Enviar evento bruto:** execute o cURL de `messages.upsert` acima e confirme o `202` na resposta.
2. **Verificar logs:** monitore `tail -f logs/api/current | rg "Evento inbound derivado de Baileys normalizado"` para validar que o fallback foi aplicado (observe `messageType` e `instanceId`).
3. **Fila e socket:** confirme no log do worker (`rg "LeadEngine • WhatsApp :: ✉️ Processando mensagem inbound fresquinha"`) que a mensagem entrou na fila e foi propagada para o socket/UI.
4. **UI/Tickets:** abra a inbox e valide se o ticket associado recebeu a mensagem com o carimbo de tempo correto e metadados (`metadata.source = raw_normalized`).
5. **Repetir com mídias/interactive:** repita o passo a passo para `imageMessage` e `buttonsResponseMessage` garantindo que os campos de mídia/seleção apareçam na UI.
