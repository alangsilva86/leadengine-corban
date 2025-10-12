#!/usr/bin/env bash
# trace_whatsapp_inbound.sh
# Roteiro cronológico para demonstrar o fluxo WhatsApp inbound → mensagens → tickets → leads → atividades
# Requisitos: bash, curl, jq, rg (ripgrep), railway CLI logado, psql disponível no container (via railway run)
set -euo pipefail

### =========================
### 0) CONFIGURAÇÃO
### =========================
TENANT="demo-tenant"
BASE_URL="https://ticketzapi-production.up.railway.app"
API_KEY="57c1acd47dc2524ab06dc4640443d755072565ebed06e1a7cc6d27ab4986e0ce"
SERVICE="@ticketz/api"

# Identificação do contato de teste (compatível com os seus exemplos)
PHONE_E164="+5511999999999"
REMOTE_JID="5511999999999@s.whatsapp.net"
PUSH_NAME="QA Bot"
INSTANCE_ID_HINT="alan"  # apenas para facilitar filtros nas consultas

# Utilitários rápidos
stamp() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
fail() { echo "ERRO: $*" >&2; exit 1; }

command -v railway >/dev/null || fail "Instale e faça login no Railway CLI"
command -v jq >/dev/null || fail "Instale jq"
command -v rg >/dev/null || fail "Instale ripgrep (rg)"
command -v curl >/dev/null || fail "Instale curl"

echo "==> Coletando DATABASE_URL do serviço…"
DB_URL="$(railway run --service "$SERVICE" -- printenv DATABASE_URL)"
[ -n "${DB_URL:-}" ] || fail "DATABASE_URL não encontrado"

### =========================
### 1) “PING” DE SANIDADE (400 esperado)
### =========================
echo "==> Enviando JSON inválido de propósito para validar erro legível (HTTP 400)…"
curl -sS -D /tmp/h_err -o /tmp/b_err -X POST "$BASE_URL/api/integrations/whatsapp/webhook" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TENANT" \
  -H "X-API-Key: $API_KEY" \
  --data-binary '{"event":"PING"}' || true

echo "---- HEADERS (erro esperado) ----"
cat /tmp/h_err
echo "---- BODY (erro esperado) ----"
cat /tmp/b_err; echo

### =========================
### 2) DISPARAR WEBHOOK VÁLIDO E CAPTURAR RID/RESPOSTA
### =========================
MSGID="BAE5-TXT-$(date +%s)"
TS="$(date +%s)"
UTC_NOW="$(stamp)"

echo "==> Disparando WHATSAPP_MESSAGES_UPSERT (válido)…"
curl -sS -D /tmp/h_ok -o /tmp/b_ok -X POST "$BASE_URL/api/integrations/whatsapp/webhook" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TENANT" \
  -H "X-API-Key: $API_KEY" \
  --data-binary @- <<JSON
{
  "event":"WHATSAPP_MESSAGES_UPSERT",
  "iid":"969a1e85-9ea0-4a78-a88a-4f64298ac80e",
  "payload":{
    "type":"notify",
    "messages":[
      {
        "key":{"remoteJid":"$REMOTE_JID","fromMe":false,"id":"$MSGID"},
        "messageTimestamp":$TS,
        "pushName":"$PUSH_NAME",
        "message":{"conversation":"ping via raw • $UTC_NOW"}
      }
    ]
  }
}
JSON

RID="$(rg -i '^x-request-id' /tmp/h_ok | awk '{print $2}' | tr -d '\r')"
echo "---- HEADERS (202 esperado) ----"
cat /tmp/h_ok
echo "---- BODY ----"
cat /tmp/b_ok; echo
echo "==> RID=$RID   MSGID=$MSGID   UTC=$UTC_NOW"

### =========================
### 3) LOGS DO SERVIÇO (filtrados)
### =========================
echo "==> Coletando logs do serviço filtrando por RID/MSGID e eventos úteis…"
railway logs --service "$SERVICE" --lines 4000 \
 | rg -vi 'status=204.*tenantId=null' \
 | rg -i -e "$RID" -e "$MSGID" \
          -e raw_inbound_normalized \
          -e raw_inbound_ignored \
          -e Webhook \
          -e Queue \
          -e Worker \
          -e emitToTenant \
          -e emitToTicket \
          -e messages\.new \
          -e tickets\.updated \
          -e leads\.updated \
          -e leadActivities\.new || true

### =========================
### 4) INSPEÇÃO DE ESQUEMA (apoio)
### =========================
echo "==> DDL resumido de tabelas principais (mensagens, leads, atividades)…"
railway run --service "$SERVICE" -- bash -lc $'psql "$DATABASE_URL" -c '\''\\d "messages"'\''' || true
railway run --service "$SERVICE" -- bash -lc $'psql "$DATABASE_URL" -c '\''\\d "leads"'\''' || true
railway run --service "$SERVICE" -- bash -lc $'psql "$DATABASE_URL" -c '\''\\d "lead_activities"'\''' || true

echo "==> Tipos/Enums relevantes…"
railway run --service "$SERVICE" -- bash -lc $'psql "$DATABASE_URL" -c '\''\\dT+ "LeadActivityType"'\''' || true
railway run --service "$SERVICE" -- bash -lc $'psql "$DATABASE_URL" -c '\''SELECT unnest(enum_range(NULL::"LeadActivityType"));'\''' || true

### =========================
### 5) CONSULTAS: EVIDÊNCIAS DO FLUXO
### =========================

# 5.1 Mensagens mais recentes do tenant (prévia)
echo "==> Mensagens recentes (prévia)…"
railway run --service "$SERVICE" -- bash -lc $'psql "$DATABASE_URL" -x <<'\''SQL'\''
SELECT "createdAt","direction","type","status",
       "externalId","idempotencyKey","instanceId",
       LEFT("content",120) AS preview
FROM   "messages"
WHERE  "tenantId" = '\'''"$TENANT"'\''' 
ORDER  BY "createdAt" DESC
LIMIT 20;
SQL'

# 5.2 Join mensagens + contato + ticket (últimos eventos)
echo "==> Mensagens + Contato + Ticket (últimos 20)…"
railway run --service "$SERVICE" -- bash -lc $'psql "$DATABASE_URL" -x <<'\''SQL'\''
SELECT m."createdAt", m."instanceId", m."content",
       c."name" AS contact_name, c."phone" AS contact_phone,
       t."id" AS ticket_id, t."status" AS ticket_status
FROM   "messages" m
LEFT JOIN "contacts" c ON c."id" = m."contactId"
LEFT JOIN "tickets"  t ON t."id" = m."ticketId"
WHERE  m."tenantId" = '\'''"$TENANT"'\''' 
  AND  m."content" LIKE '\'''ping via raw %'\''' 
ORDER  BY m."createdAt" DESC
LIMIT 20;
SQL'

# 5.3 Leads por recência (a lista que a Inbox deveria renderizar)
echo "==> Leads por recência (COALESCE(lastContactAt, createdAt))…"
railway run --service "$SERVICE" -- bash -lc $'psql "$DATABASE_URL" -x <<'\''SQL'\''
SELECT l."id", l."status", l."source", l."contactId",
       l."lastContactAt", l."createdAt"
FROM "leads" l
WHERE l."tenantId" = '\'''"$TENANT"'\''' 
ORDER BY COALESCE(l."lastContactAt", l."createdAt") DESC
LIMIT 30;
SQL'

# 5.4 Atividades de lead recentes
echo "==> Lead activities recentes…"
railway run --service "$SERVICE" -- bash -lc $'psql "$DATABASE_URL" -x <<'\''SQL'\''
SELECT la."createdAt", la."leadId", la."type", la."title"
FROM "lead_activities" la
JOIN "leads" l ON l."id" = la."leadId"
WHERE la."tenantId" = '\'''"$TENANT"'\''' 
ORDER BY la."createdAt" DESC
LIMIT 20;
SQL'

# 5.5 Eventos processados pelo broker (audit trail)
echo "==> processed_integration_events (amostra)…"
railway run --service "$SERVICE" -- bash -lc $'psql "$DATABASE_URL" -x <<'\''SQL'\''
SELECT "createdAt","source",
       LEFT(CAST("payload" AS text), 200) AS payload_preview
FROM   "processed_integration_events"
ORDER  BY "createdAt" DESC
LIMIT 20;
SQL'

# 5.6 Sanidade: contagem de mensagens por lead
echo "==> Leads com contagem de mensagens associadas…"
railway run --service "$SERVICE" -- bash -lc $'psql "$DATABASE_URL" -x <<'\''SQL'\''
SELECT l."id", l."contactId", COUNT(m.*) AS msgs
FROM "leads" l
LEFT JOIN "messages" m
  ON m."tenantId" = l."tenantId"
 AND m."contactId" = l."contactId"
WHERE l."tenantId" = '\'''"$TENANT"'\''' 
GROUP BY l."id", l."contactId"
ORDER BY msgs DESC, l."id";
SQL'

### =========================
### 6) INTEGRIDADE: ÍNDICES/CONSTRAINTS ÚTEIS
### =========================
echo "==> Verificando índices essenciais…"
railway run --service "$SERVICE" -- bash -lc $'psql "$DATABASE_URL" -x <<'\''SQL'\''
-- Unicidade lead por contato/tenant
SELECT i.relname AS index_name, pg_get_indexdef(ix.indexrelid) AS def
FROM   pg_index ix
JOIN   pg_class i ON i.oid = ix.indexrelid
JOIN   pg_class t ON t.oid = ix.indrelid
JOIN   pg_namespace n ON n.oid = t.relnamespace
WHERE  n.nspname='public' AND t.relname='leads';

-- Índices recentes de mensagens por ticket e instância
SELECT i.relname AS index_name, pg_get_indexdef(ix.indexrelid) AS def
FROM   pg_index ix
JOIN   pg_class i ON i.oid = ix.indexrelid
JOIN   pg_class t ON t.oid = ix.indrelid
JOIN   pg_namespace n ON n.oid = t.relnamespace
WHERE  n.nspname='public' AND t.relname='messages';
SQL'

### =========================
### 7) RESUMO DO QUE PRECISA ESTAR CERTO (CHECKLIST)
### =========================
cat <<'TXT'

========================================
CHECKLIST DO PIPELINE (o que a coleta acima prova/nega)
========================================
[ ] 1. Webhook aceita payload (HTTP 202) e retorna x-request-id (RID).
[ ] 2. Logs mostram normalização do inbound e enfileiramento/worker sem erros 5xx.
[ ] 3. Tabela messages tem o registro com ticketId e instanceId corretos.
[ ] 4. Existe/é feito upsert de leads por (tenantId, contactId).
[ ] 5. Campo lastContactAt do lead é atualizado com o createdAt da mensagem.
[ ] 6. lead_activities grava uma entrada WHATSAPP_REPLIED com occurredAt = createdAt da msg.
[ ] 7. Eventos de socket emitidos: messages.new, tickets.updated e (ideal) leads.updated.
[ ] 8. Índice único em leads (tenantId, contactId) evita duplicação sob concorrência.
[ ] 9. Índices de recência garantem ordenação da Inbox sem full scan.
TXT

echo "==> FIM. RID=$RID  MSGID=$MSGID"
