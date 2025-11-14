# Observabilidade das integrações WhatsApp

Este documento descreve os painéis de Grafana e alertas de Prometheus recomendados para monitorar a saúde das integrações WhatsApp após a padronização dos labels das métricas.

## Painéis de Grafana

### 1. Visão geral por instância

* **Latência P95 de envio (`whatsapp_outbound_latency_ms`)** – painel `Stat + Time series` agrupado por `instanceId` e `tenantId`. Utilize `histogram_quantile(0.95, sum(rate(whatsapp_outbound_latency_ms_sum[5m])) by (instanceId, tenantId) / sum(rate(whatsapp_outbound_latency_ms_count[5m])) by (instanceId, tenantId))`.
* **Mensagens enviadas por status (`whatsapp_outbound_total`)** – gráfico de barras `Stacked` segmentado por `status` e filtrável por `origin`.
* **Sucesso de entrega por tipo (`whatsapp_outbound_delivery_success_total`)** – tabela com `messageType` e `status`, destacando a taxa de sucesso por instância.

### 2. Confiabilidade da ingestão

* **Eventos de webhook processados (`whatsapp_webhook_events_total`)** – série temporal com `origin="webhook"` e facet por `tenantId`.
* **Mensagens inbound processadas (`inbound_messages_processed_total`)** – painel `Stat` comparando últimos 60 minutos vs. 24h para detectar quedas.

### 3. Resiliência da sessão

* **Reconexões de socket (`whatsapp_socket_reconnects_total`)** – gráfico de colunas agrupado por `instanceId` para identificar instâncias instáveis.
* **Mapa de calor de reconexões por hora** – painel `Heatmap` utilizando `increase(whatsapp_socket_reconnects_total[1h])` com eixos `hora do dia` × `instanceId`.

### 4. Funil de vendas

* **Simulações registradas (`sales_simulation_total`)** – painel `Stat` ou `Bar chart` segmentado por `agreementId` e `productType` para acompanhar quantas simulações foram criadas em cada convênio.
* **Propostas geradas (`sales_proposal_total`)** – série temporal com `sum(rate(sales_proposal_total[15m])) by (tenantId, agreementId)` para visualizar o ritmo de avanço para propostas.
* **Deals concluídos (`sales_deal_total`)** – gráfico acumulado por estágio (`stage`) destacando as conversões em `LIQUIDACAO` e `APROVADO_LIQUIDACAO`.
* **Distribuição por estágio (`sales_funnel_stage_total`)** – tabela que cruza `dimension` e `dimensionValue` (por exemplo `agreement` ou `product`) mostrando o total de operações registradas em cada etapa do funil.

> Todas as métricas do funil incluem labels padronizados (`tenantId`, `stage`, `agreementId`, `agreementName`, `campaignId`, `productType`, `strategy`) permitindo filtros consistentes com os relatórios operacionais.

## Alertas de Prometheus

| Nome | Regra | Objetivo |
| ---- | ----- | -------- |
| `WhatsAppOutboundLatencyP95High` | `histogram_quantile(0.95, sum(rate(whatsapp_outbound_latency_ms_sum[5m])) by (instanceId) / sum(rate(whatsapp_outbound_latency_ms_count[5m])) by (instanceId)) > 3000` por 10 minutos | Disparar quando o P95 de envio ultrapassar 3 segundos. |
| `WhatsAppOutboundErrorRate` | `sum(rate(whatsapp_outbound_total{status!="SENT"}[5m])) by (instanceId) / sum(rate(whatsapp_outbound_total[5m])) by (instanceId) > 0.1` por 5 minutos | Detectar aumento de falhas acima de 10%. |
| `WhatsAppSocketReconnectBurst` | `increase(whatsapp_socket_reconnects_total[15m]) > 3` | Indicar instâncias que estão reconectando excessivamente em um curto período. |

## Boas práticas

* Sempre filtre por `origin` para diferenciar tráfego de broker, webhook e serviços internos.
* Aplique `tenantId` nos painéis quando investigar problemas específicos de clientes corporativos.
* Utilize `instanceId="overflow"` como indicador de que a cardinalidade está acima do limite recomendado e revise a configuração do tenant/instância.
* Remova filtros/legendas que dependiam de `transport="sidecar"` ou `mode="sidecar"`; o único valor esperado é `http`. Configure alertas para disparar se `/healthz` reportar qualquer modo diferente de `http`.
