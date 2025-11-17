# Análise dos erros 502 e impactos em cadeia

## Visão geral
Os logs capturados revelam uma sequência de falhas ao carregar recursos críticos no front-end, todas convergindo para respostas **502 Bad Gateway** ao tentar se comunicar com a API. As mensagens indicam que o problema começa ao carregar o usuário atual e se estende para a rota de debug do Baileys, afetando a visualização de eventos no painel.

## Passo a passo por fase
1. **Fase 1 – Requisição inicial de usuário (`hook.js:608` / `index-_ZzH7U4v.js`)**  
   O front-end tenta carregar o usuário atual via hook personalizado. A chamada à API retorna 502 e o erro propagado (`Erro ao comunicar com a API`) é tratado no módulo `No` do bundle.

2. **Fase 2 – Propagação no fluxo assíncrono (`index-_ZzH7U4v.js`)**  
   Após a falha inicial, funções assíncronas subsequentes (`o` e outra função anônima em `index-_ZzH7U4v.js`) são executadas, mas dependem da resposta válida do backend. Como a resposta é inválida, a exceção continua se propagando e impede a inicialização correta do estado do usuário.

3. **Fase 3 – Requisição de eventos do Baileys (`/api/debug/baileys-events`)**  
   O painel tenta carregar os eventos de debug (`BaileysLogs`). A chamada para `/api/debug/baileys-events?limit=50` também recebe 502, gerando nova ocorrência de `Erro ao comunicar com a API` no mesmo módulo (`No`) e abortando o carregamento da tabela de logs.

4. **Fase 4 – Estado final observado**  
   Com as falhas anteriores, os componentes dependentes (carregamento de usuário e logs do Baileys) não recebem dados, resultando em telas vazias ou mensagens de erro no painel administrativo.

## Plano de ajustes, melhorias e otimizações
- **[Fase 1] Diagnóstico do backend e health-check**
  Investigar por que o gateway está devolvendo 502 para a rota de usuário: validar disponibilidade do serviço upstream, revisar logs do reverse proxy e instrumentar health-checks que alertem antes da falha chegar ao front-end.

- **[Fases 1 e 2] Tratamento resiliente no front-end**  
  Implementar fallback ou mensagens mais orientativas quando a chamada de usuário falhar, impedindo que erros não tratados cascata sejam propagados e permitindo tentativa de reconexão.

- **[Fase 3] Observabilidade específica para `/api/debug/baileys-events`**  
  Adicionar métricas e logging detalhado nesta rota para identificar rapidamente indisponibilidades e diferenciar problemas de autenticação, timeout ou indisponibilidade do serviço Baileys.

- **[Fase 4] Alertas de UX e estado offline**  
  Introduzir um modo degradado que indique claramente aos operadores que os dados de debug não estão disponíveis, mantendo o painel funcional para outras operações e evitando confusão com telas vazias.

- **[Fases 1–3] Testes automatizados end-to-end com simulação de falhas**
  Criar cenários de teste que emulem respostas 502 para garantir que o front-end lida corretamente com indisponibilidade da API e que os alertas operacionais são disparados.

- **[Fases 1–4] Documentação de recuperação**
  Registrar procedimentos para reinício/rollback do serviço afetado, garantindo que a equipe consiga restaurar rapidamente o funcionamento quando falhas similares ocorrerem.

## Implementações recentes por fase
- **Fase 1** – o endpoint `/healthz` agora expõe `whatsapp.broker` (circuit breaker, último sucesso/falha e ID da última ocorrência) e o `POST /api/tickets/messages` grava logs estruturados com `tenantId`, `ticketId`, `instanceId`, `requestId` e métricas Prometheus (`whatsapp_outbound_*`). Esses dados alimentam o novo serviço `broker-observability`, consumido também nos testes de unidade.
- **Fases 1 e 2** – o hook `useSendMessage` ganhou retry exponencial com telemetria (`chat.outbound_retry_*`) e o script `scripts/whatsapp-smoke-test.ts` passou a validar envios outbound autenticados (`ACCESS_TOKEN`). No front-end, o composer exibe um estado “Reconectar ao WhatsApp” com o `requestId` retornado pela API, permitindo novas tentativas sem recarregar a página.
- **Fase 3** – os componentes de debug (`BaileysLogs`) exibem o `requestId` e o `recoveryHint` retornados pelo backend, e a API instrumenta o transporte direto (`transport.sendMessage`) com métricas de latência/sucesso.
- **Fase 4** – quando o broker retorna 502, o backend confirma que a mensagem foi persistida (`queuedMessageId`), envia um `recoveryHint` e a UI mostra esse contexto no composer, além de disponibilizar o atalho de reconexão.
- **Fases 1–4** – os testes `apps/api/src/routes/__tests__/tickets.messages.spec.ts` agora simulam `WhatsAppTransportError` para garantir resposta 502 estruturada, e `docs/analise-502-debug.md` lista o runbook abaixo para orientar o time durante incidentes.

## Runbook de recuperação por fase
1. **Fase 1 – API e broker**
   - Consultar `/healthz` e confirmar `whatsapp.broker.degraded`.
   - Verificar circuit breaker (`whatsapp.broker.circuitBreaker.state`), reiniciar a instância do broker se `state === 'OPEN'` e notificar o time de plataforma.
   - Executar `pnpm test:whatsapp` com `ACCESS_TOKEN` configurado para validar envios inbound/outbound pós-ajuste.
2. **Fase 2 – Front-end/operador**
   - Monitorar os eventos `chat.outbound_retry_*` no console e orientar o operador a usar o botão “Reconectar ao WhatsApp” exibido no composer.
   - Caso o erro persista, coletar `requestId` do banner e correlacionar com os logs estruturados do backend.
3. **Fase 3 – Observabilidade do Baileys**
   - Acessar `/debug/baileys-events` para conferir o `requestId` mais recente e validar se o `recoveryHint` aponta fila ou autenticação.
   - Se `status >= 502`, reprocessar a instância (via painel de instâncias) e repetir o smoke test.
4. **Fase 4 – Comunicação com operadores**
   - Informar ao time de atendimento que a mensagem foi salva (`queuedMessageId` exibido na resposta) e que o sistema fará retry automático.
   - Registrar em post-mortem os horários (`whatsapp.broker.lastFailureAt/lastSuccessAt`) para alimentar análises futuras.
