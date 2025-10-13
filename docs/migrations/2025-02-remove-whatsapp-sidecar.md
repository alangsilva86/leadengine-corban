# Migração: Remoção do sidecar WhatsApp e volume `whatsapp_sessions_data`

## Contexto

A partir da release de 25/02/2025, o Ticketz LeadEngine opera exclusivamente com o broker HTTP oficial. O modo sidecar Baileys foi descontinuado, bem como o volume Docker `whatsapp_sessions_data`. Esta nota orienta as equipes de infraestrutura a concluir a limpeza com segurança.

## Escopo

- Clusters Docker Compose (dev, staging, produção) que utilizavam o sidecar local.
- Pipelines GitOps/CI que criavam o volume `whatsapp_sessions_data` ou aplicavam manifests com o contêiner sidecar.
- Playbooks de rollback que alternavam `WHATSAPP_MODE` entre `http` e `sidecar` (a variável agora provoca falha imediata ao inicializar a API).

## Passo a passo

1. **Atualizar variáveis de ambiente**
   - Remova `WHATSAPP_MODE` das `.env`/secrets. A API opera apenas em HTTP e aborta o processo se a variável estiver definida.
   - Revise segredos relacionados ao broker (`WHATSAPP_BROKER_URL`, `WHATSAPP_BROKER_API_KEY`, `WHATSAPP_WEBHOOK_API_KEY`) garantindo que apontem para o serviço HTTP definitivo.

2. **Atualizar orquestração Docker**
   - Aplique os novos `docker-compose.yml`/`docker-compose.prod.yml` sem o volume `whatsapp_sessions_data`.
   - Execute `docker compose down` seguido de `docker compose up -d` para recriar os serviços API/Web.
   - Confirme que nenhum serviço `*-sidecar` aparece em `docker compose ps`.

3. **Remover o volume legado**
   - Liste volumes órfãos com `docker volume ls | grep whatsapp_sessions_data`.
   - Caso exista, execute `docker volume rm whatsapp_sessions_data` após garantir que nenhum contêiner antigo o utiliza.
   - Se o volume estiver sendo replicado via snapshots/backups, elimine-os para liberar espaço e evitar restaurações acidentais.

4. **Limpar pipelines CI/CD**
   - Ajuste jobs que criavam o volume ou implantavam o contêiner sidecar (Render, Railway, Kubernetes, etc.).
   - Remova scripts de rollback que alteravam `WHATSAPP_MODE` para `sidecar`; a variável agora é considerada inválida.
   - Atualize dashboards e alertas que monitoravam o `transport="sidecar"`; as métricas agora não possuem label de transporte.

5. **Verificações pós-migração**
   - Rode `curl -H "X-API-Key: $WHATSAPP_BROKER_API_KEY" $API_URL/healthz | jq '.whatsapp.runtime'` para confirmar `mode="http"` e `status="running"`.
   - Execute `scripts/whatsapp-smoke-test.mjs` e valide sucesso no envio/recepção via broker HTTP.
   - Confirme que métricas `whatsapp_webhook_events_total` continuam incrementando após a remoção do label `transport`.

## Rollback

Como não há mais sidecar suportado, um rollback deve focar em restaurar as credenciais HTTP e, se necessário, reverter para uma tag anterior do LeadEngine que ainda aceitava o sidecar. Não reinstale o contêiner legado em ambientes que já receberam esta release.

## Comunicações

- Notifique squads dependentes (Atendimento, Operações) sobre a remoção para alinharem procedimentos de pareamento.
- Atualize runbooks internos que mencionem comandos `docker volume create whatsapp_sessions_data` ou pods sidecar.

