# WhatsApp Railway Shell cURL Recipes

Use these snippets when you need to validate the inbound webhook and outbound delivery flows directly from a Railway shell session (API service).

## Prerequisites

1. Open the shell for the **API** service in Railway (`ticketzapi-production`).
2. Export the environment variables matching the deployment secrets (adjust paths if your secrets live elsewhere):

```bash
export API_URL="https://ticketzapi-production.up.railway.app"          # replace with the environment specific host if different
export WHATSAPP_WEBHOOK_API_KEY="$(cat /etc/secrets/whatsapp_webhook_api_key)"
export TENANT_ID="demo-tenant"
export INSTANCE_ID="alan"
export WHATSAPP_INBOUND_SIMPLE_MODE="true"                             # optional: disables dedupe/CRM to focus on chat visibility
# Optional: only needed if MVP auth bypass is disabled
# export AUTH_TOKEN="<jwt-token>"
```

> ℹ️ With `MVP_AUTH_BYPASS=true` (enabled in demos), the API injects the bypass user automatically and you **do not** need the `Authorization` header. Keep the header enabled in production environments.

> 🔐 Default (strict) mode requires the `x-api-key` header and, when configured, the `x-signature-sha256` HMAC. If the deployment
> enables `WHATSAPP_PASSTHROUGH_MODE=true`, both validations are skipped and you may omit these headers—only do so in trusted
> environments where webhook traffic is already controlled.

## Inbound webhook check

Trigger ingestion with a representative WhatsApp event:

```bash
curl -X POST "$API_URL/api/integrations/whatsapp/webhook" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $WHATSAPP_WEBHOOK_API_KEY" \
  -d '{
    "events": [
      {
        "id": "wamid-123",
        "instanceId": "'"$INSTANCE_ID"'",
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
          "source": "railway-shell"
        }
      }
    ]
  }'
```

A successful request returns `{ "ok": true }`. Tail the worker logs to confirm the event was enqueued and processed:

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
      "text": "Mensagem de teste enviada da shell Railway"
    },
    "idempotencyKey": "railway-shell-test-$(date +%s)"
  }'
```

A successful response returns HTTP `200` with the enqueue confirmation. Inspect the payload to verify the broker metadata (`status`/`ack`) captured on the message record.

> 💡 Need to test media or template flows? Replace the body with the payload from `docs/whatsapp-broker-contracts.md` while keeping the same headers.

## Raw `messages.upsert` fallback

When `WHATSAPP_RAW_FALLBACK_ENABLED=true`, the webhook accepts Baileys `WHATSAPP_MESSAGES_UPSERT` events and converts them into `MESSAGE_INBOUND`. Use the snippet below to emulate the broker sending a raw payload:

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

The API replies with HTTP `200` when at least one message is normalized. Check the worker logs (`tail -n 200 -f logs/api/current | rg "raw_inbound_normalized"`) to confirm the fallback was triggered and the broker metadata was appended to the queue event.

## Replay Baileys connector logs

Use the helper script below to replay events stored by the Baileys connector (`baileys-acessuswpp`). This is helpful when validating that `MESSAGE_INBOUND` payloads end up in `/debug/baileys-events` without relying on live traffic.

```bash
# Defaults: URL=http://localhost:3000/api/integrations/whatsapp/webhook
# and API key from WHATSAPP_WEBHOOK_API_KEY / WHATSAPP_BROKER_API_KEY
pnpm exec tsx scripts/replay-baileys-log.ts ./logs/baileys.ndjson --url="$API_URL/api/integrations/whatsapp/webhook"
```

The script accepts logs formatted as newline-delimited JSON. Each line must contain either a raw Baileys payload or an envelope with a `payload`/`event` property. Failed lines are reported but the replay continues processing the remainder of the file.

## Automated smoke test

Validate the full webhook → socket → UI flow quickly with the bundled smoke runner:

```bash
API_URL="https://ticketzapi-production.up.railway.app" \
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

If any step fails, the process exits with a non-zero code and prints the reason (webhook, socket, or persistence).

## Troubleshooting tips

- **401 responses** usually mean the API key or auth token is missing. Double-check the headers exported above.
- **503 responses** point to service availability problems. Re-run `curl "$API_URL/healthz"` and inspect API logs for `whatsapp` errors.
- **Message queued but not delivered?** Verify the instance connection via `curl "$API_URL/api/integrations/whatsapp/instances/$INSTANCE_ID/status"` and reconnect if needed.

## QA checklist – raw fallback

1. **Enviar evento bruto:** execute o cURL de `messages.upsert` acima e confirme o `202` na resposta.
2. **Verificar logs:** monitore `tail -f logs/api/current | rg "Evento inbound derivado de Baileys normalizado"` para validar que o fallback foi aplicado (observe `messageType` e `instanceId`).
3. **Fila e socket:** confirme no log do worker (`rg "LeadEngine • WhatsApp :: ✉️ Processando mensagem inbound fresquinha"`) que a mensagem entrou na fila e foi propagada para o socket/UI.
4. **UI/Tickets:** abra a inbox e valide se o ticket associado recebeu a mensagem com o carimbo de tempo correto e metadados (`metadata.source = raw_normalized`).
5. **Repetir com mídias/interactive:** repita o passo a passo para `imageMessage` e `buttonsResponseMessage` garantindo que os campos de mídia/seleção apareçam na UI.
