# Etapa 4 — Dashboard Operacional

A etapa 4 concentra a implementação da visão geral de tickets e leads no frontend (`apps/web`). A dashboard agora consome dados
reais dos serviços da API, eliminando valores mockados e refletindo o comportamento do ambiente conectado ao `VITE_API_URL`.

## Endpoints Consumidos

| Endpoint | Descrição | Uso na dashboard |
| --- | --- | --- |
| `GET /api/tickets` | Lista paginada de tickets, incluindo status, canal e metadados. | Base para métricas de tickets ativos, distribuição por canal, gráfico diário e lista de tickets recentes. |
| `GET /api/leads` | Lista paginada de leads do tenant atual. | Alimenta a série histórica de leads e contribui para o cálculo de conversões. |
| `GET /api/lead-engine/dashboard` | Endpoint agregador que consolida totais de leads, leads quentes e taxa de conversão por tenant. | Fornece números agregados para os cards de "Leads Novos" e "Taxa de Conversão", além de servir como fallback para métricas consolidadas. |

> ℹ️ Todos os endpoints são chamados com `fetch` via `apiGet`, que já adiciona `Authorization` e `x-tenant-id` com base na configuração do tenant atual.

## Boas Práticas adotadas

- **React Query (`@tanstack/react-query`)**: utilizado para cache, refetch e estados de carregamento/erro da dashboard.
- **Fallbacks resilientes**: todos os cálculos tratam campos ausentes ou respostas vazias, exibindo `'—'` ou mensagens de estado quando não há dados.
- **Feedback visual**: skeletons para carregamento inicial, alertas (`Alert`) em caso de falha e mensagens amigáveis quando não há registros.

## Próximos Passos sugeridos

1. Expor contagens de mensagens e conversões diretamente da API para refinar métricas diárias.
2. Estender o endpoint `/api/lead-engine/dashboard` com comparativos semanais/mensais, aproveitando o mesmo fluxo em React Query.
3. Conectar ações dos cartões e da lista de tickets a páginas/rotas específicas quando estiverem disponíveis.
