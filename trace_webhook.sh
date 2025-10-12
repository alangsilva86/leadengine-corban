#!/usr/bin/env bash
set -euo pipefail

SVC="@ticketz/api"
API="https://ticketzapi-production.up.railway.app"
TENANT="demo-tenant"
IID="969a1e85-9ea0-4a78-a88a-4f64298ac80e"
KEY="57c1acd47dc2524ab06dc4640443d755072565ebed06e1a7cc6d27ab4986e0ce"

MSGID="BAE5-TXT-$(date +%s)"
TS=$(date +%s)
UTC=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

RID=$(
  curl -sS -i -X POST "$API/api/integrations/whatsapp/webhook" \
    -H "Content-Type: application/json" \
    -H "x-tenant-id: $TENANT" \
    -H "X-API-Key: $KEY" \
    --data-binary @- <<JSON | rg -i '^x-request-id' | awk '{print $2}' | tr -d '\r'
{
  "event":"WHATSAPP_MESSAGES_UPSERT",
  "iid":"$IID",
  "payload":{"type":"notify","messages":[
    {"key":{"remoteJid":"5511999999999@s.whatsapp.net","fromMe":false,"id":"$MSGID"},
     "messageTimestamp":$TS,
     "pushName":"QA Bot",
     "message":{"conversation":"ping via raw • $UTC"}}]}}
JSON
)

echo "RID=$RID  MSGID=$MSGID"

railway logs --service "$SVC" --lines 4000 \
| rg -vi 'status=204.*tenantId=null' \
| rg -i -e "$RID" -e "$MSGID" -e raw_inbound_normalized -e Queue -e Worker -e emitToTenant -e emitToTicket
