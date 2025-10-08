# WhatsApp Render Shell cURL Recipes

These snippets help operators validate the WhatsApp webhook (inbound) and outbound delivery flows directly from a Render shell session.

## Prerequisites

1. Open the shell for the API service in Render.
2. Export the environment variables that mirror the deployment secrets:

```bash
export API_URL="https://leadengine-corban.onrender.com"            # or the environment specific host
export WHATSAPP_WEBHOOK_API_KEY="$(cat /etc/secrets/whatsapp_webhook_api_key)"  # adjust path if secrets differ
export TENANT_ID="demo-tenant"                                     # tenant served by the MVP bypass
# Optional: only needed if MVP auth bypass is disabled
# export AUTH_TOKEN="<jwt-token>"
```

> ℹ️ When `MVP_AUTH_BYPASS=true` (default in demos), the API automatically injects the bypass user and you do **not** need the `Authorization` header. In production environments keep the header enabled.

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
        "instanceId": "${TENANT_ID}",
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
curl -X POST "$API_URL/api/integrations/whatsapp/messages" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TENANT_ID" \
  ${AUTH_TOKEN:+-H "Authorization: Bearer $AUTH_TOKEN"} \
  -d '{
    "to": "+5511999999999",
    "message": "Mensagem de teste enviada do Render shell",
    "previewUrl": false,
    "externalId": "render-shell-test-$(date +%s)"
  }'
```

A successful response returns HTTP `202` with the WhatsApp broker acknowledgement payload. Look for an `ack` of `server` or `delivery` to confirm the broker accepted the message.

> 💡 Need to test media or template flows? Replace the body with the payload documented in `docs/whatsapp-broker-contracts.md` while keeping the same headers.

## Troubleshooting tips

- **401 responses** usually mean the API key or auth token is missing. Double-check the headers exported above.
- **503 responses** point to broker connectivity problems. Re-run `curl "$API_URL/healthz"` and inspect the API logs for `whatsapp` errors.
- **Message queued but not delivered?** Verify the instance connection via `curl "$API_URL/api/integrations/whatsapp/session/status"` and reconnect if needed.
