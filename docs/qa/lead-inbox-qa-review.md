# QA Review – Evolução da Inbox de Leads

> **Atualização (jan/2025):** o módulo legado `LeadInbox` citado nesta revisão foi removido e substituído pelo `ChatCommandCenter`. O documento permanece como registro histórico das lacunas identificadas antes da migração.

## Escopo e abordagem
- **Contexto analisado**: revisão da implementação da Inbox de Leads antes da migração para o `ChatCommandCenter`, após a inclusão da barra de filtros globais, views salvas com contadores e ajustes no painel de ações.
- **Metodologia**: análise estática de código, revisão do plano evolutivo (Epics A–G) e verificação dos fluxos críticos descritos nas histórias B1 e B2. Execução de lint para validar a saúde do pacote web (falha por dívida preexistente).
- **Ambiente**: repositório `apps/web`, componentes legados `LeadInbox`, `GlobalFiltersBar`, `InboxActions`, `StatusFilter` e tokens de tema em `App.css`.

## Passo a passo por épico

### EPIC A — Shell estrutural (Utility Bar e Abas)
- **Resultado**: Não implementado. Nenhum componente ou estado relacionado a utility bar persistente ou abas de workspace foi encontrado na árvore da Inbox.
- **Impacto**: agentes ainda trocam de contexto navegando entre telas, sem persistência de utilitários ou limites de abas por agente.

### EPIC B — Cabeçalho de filtros globais
- **História B1 – Views salvas e contadores**
  - **Implementado parcialmente (legado)**: `LeadInbox` armazenava filtros e views em `localStorage`, reconciliava automaticamente a view ativa e calculava contadores em tempo real a partir da lista filtrada (componente removido na migração para o `ChatCommandCenter`).
  - **Observações de QA**:
    - O nome da visão depende de `window.prompt`, o que não atende requisitos de UX acessível nem previsibilidade para cadastros corporativos.
    - Falta feedback sobre expiração automática: views removidas após 30 dias são apenas podadas silenciosamente.
- **História B2 – Progressive disclosure de filtros**
  - **Implementado (legado)**: barra rápida com status/filas/janela + drawer "Mais filtros" com campos avançados e persistência por usuário.
  - **Gap**: filtro de status cobria somente quatro estados (`Todos`, `Em conversa`, `Venda realizada`, `Sem interesse`), enquanto as regras de negócio listavam sete estados (Novo, Em atendimento, Aguardando cliente, Aguardando terceiro, Pausado, Ganho, Perdido).

### EPIC C — Lista / Inbox
- **Resultado**: Não há modos de visualização alternativos (Lista/Kanban/SLA lanes) nem ações em lote implementadas. O componente `InboxList` continua renderizando apenas cartões lineares sem seleção múltipla ou tooltips de SLA.

### EPIC D — Workspace do ticket
- **Resultado**: Nenhum traço de thread omnichannel, composer com snippets ou "próxima ação" foi encontrado na camada atual; permanece o comportamento legado.

### EPIC E — Painéis contextuais
- **Resultado**: inexistentes. Não há componentes reordenáveis ou persistência de layout de painéis laterais.

### EPIC F — Roteamento e filas inteligentes
- **Resultado**: ausência de lógica de roteamento/balanceamento no front analisado. A tela depende da lista já roteada pelo backend.

### EPIC G — Acessibilidade, Dark Mode e Performance
- **Status**: tokens globais contemplam contrastes aprimorados e foco reforçado para pills de filtro, mas ainda não há validação automatizada de contrast ratio nem medições de performance (TTFB, virtualização).【F:apps/web/src/App.css†L1-L160】

## Testes realizados
- ✅ Revisão de código estática com foco em critérios B1/B2 (sem ferramenta automatizada).
- ❌ `pnpm -C apps/web lint` *(falha preexistente: no-unused-vars em apps/web/src/features/whatsapp/connect/index.tsx).*.

## Principais achados e itens pendentes
1. **Cobertura incompleta de estados de ticket** – filtro não contempla estados exigidos pelas regras de negócio, inviabilizando governança de SLA.
2. **Criação de views via prompt** – interação bloqueia a UI, não tem acessibilidade e dificulta padronização de nomenclatura; recomenda-se modal/form estruturado.
3. **Ausência de feedback sobre auto-refresh** – badge exibe contagem, mas falta histórico de atualização/sincronização contínua com eventos de telemetria conforme plano (eventos `view_change`, `filter_apply` ainda não coletados).
4. **Fases seguintes sem backlog refinado** – Epics C–G permanecem não iniciados; sugerir roadmap detalhado ou issues para garantir alinhamento com Definition of Done.
5. **Dados avançados nos filtros** – Drawer não oferece filtros por origem comercial/canal mencionados nos requisitos; necessário evoluir heurística "Mais filtros".

## Recomendações
- Priorizar ampliação do `StatusFilter` e introduzir uma estrutura declarativa para estados (com metadados de transição e cores) antes de liberar para agentes.
- Substituir o `window.prompt` por modal acessível com validação e preview de contagem antes de salvar.
- Instrumentar eventos de telemetria (`filter_apply`, `view_change`, `lane_switch`) e preparar testes de performance/acessibilidade automatizados para atender DoD global.
- Planejar entregas das Epics C–G com protótipos e critérios mensuráveis, evitando desvio do roadmap descrito.
