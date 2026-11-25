# Tokens do design system

Os tokens ficam em `apps/web/src/styles/theme.css`, em três camadas:

1. **Paleta base (`--ds-*`)**: a única fonte da verdade, com valores para o tema claro (`:root`) e escuro (`.dark`).
2. **Compatibilidade (`--sys-*` e nomes antigos)**: apontam para a paleta base para que componentes legados continuem funcionando. Não use em código novo.
3. **`@theme`**: registra as classes do Tailwind (`bg-primary`, `text-muted-foreground`…).

Para mudar uma cor, altere só a paleta base e mantenha os contrastes abaixo. Não há `tailwind.config`: o Tailwind 4 lê os tokens de `src/styles/theme.css`, e as histórias "Tokens/Cores" e "Tokens/Sombras" do Storybook leem o mesmo arquivo.

O tema escuro segue a classe `.dark` aplicada pelo `next-themes` (`@custom-variant dark`), e não a preferência do sistema operacional.

## Marca

- **Primária: azul cobalto** (`#1c5bd6` no claro, `#2f6ae0` no escuro). É a cor de ação e de seleção em todo o produto, inclusive no Inbox.
- **Verde do WhatsApp** (`whatsapp`) serve só para identificar o canal: ponto, ícone, selo. Nunca como cor de botão ou de marca.
- **Verde de sucesso** (`success`) é diferente do verde do WhatsApp e só indica estado positivo.

## Classes para código novo

| Intenção | Classes |
| --- | --- |
| Fundo da página | `bg-background` |
| Cartões, painéis, listas | `bg-surface` / `bg-card` |
| Área rebaixada, trilhos, chips neutros | `bg-surface-sunken` |
| Hover de linha ou item | `hover:bg-surface-hover` |
| Popover, menu | `bg-popover` |
| Texto principal / secundário / terciário | `text-foreground` / `text-muted-foreground` / `text-subtle-foreground` |
| Bordas | `border-border` (padrão), `border-border-strong` (controles) |
| Ação principal | `bg-primary text-primary-foreground hover:bg-primary-hover` |
| Realce de seleção | `bg-primary-soft text-primary-soft-foreground` |
| Status | `bg-{success,warning,danger,info}-soft text-{…}-soft-foreground`; sólido: `bg-{…} text-{…}-foreground` |
| Canal WhatsApp | `bg-whatsapp`, `bg-whatsapp-soft text-whatsapp-soft-foreground` |
| Bolhas de conversa | `bg-bubble-in` (recebida), `bg-bubble-out` (enviada), `bg-bubble-note` (nota interna) |
| Gráficos | `var(--color-chart-1…5)`: categóricas, nunca para status |

Regras:

- **Não use cores fixas** (`emerald-500`, `slate-900`, `text-white`, hex, `rgba(…)`). Elas quebram o tema claro ou o escuro.
- Texto "soft" sempre sobre fundo "soft" do mesmo tom. Os pares foram calculados para ter pelo menos 4,5:1.
- Valores em R$ e contagens usam `tabular-nums`.
- Não use `uppercase` com `tracking` largo, exceto no cabeçalho de colunas de tabela. O menor tamanho de texto é `text-2xs` (11px), só para contadores.

## Contraste verificado

Mínimos WCAG 2.2 AA: 4,5:1 para texto e 3:1 para bordas de controles.

| Par | Claro | Escuro |
| --- | --- | --- |
| `foreground` / `background` | 16,4:1 | 16,6:1 |
| `muted-foreground` / `surface` | 6,1:1 | 7,7:1 |
| `subtle-foreground` / `surface` | 5,0:1 | 5,5:1 |
| texto branco / `primary` | 6,0:1 | 4,9:1 |
| texto branco / `success` · `danger` | 5,2:1 · 5,6:1 | 5,4:1 · 4,6:1 |
| `*-soft-foreground` / `*-soft` | 6,7 a 7,2:1 | 9,0 a 9,5:1 |
| `input` (borda) / `surface` | 3,2:1 | 3,0:1 |

No escuro, `text-primary` usa o tom claro da marca (`primary-soft-foreground`, 10,9:1), porque o azul do botão não alcança 4,5:1 sobre fundo escuro.

## Primitivos

| Componente | Uso |
| --- | --- |
| `Button` | Variantes `default` (uma ação principal por área), `outline`, `secondary`, `soft`, `ghost`, `destructive`, `link`. Tamanhos `xs` (28px), `sm` (32), `default` (36), `lg` (40), `icon` (36), `icon-sm` (32), `icon-xs` (28). Botão só com ícone exige `aria-label` e Tooltip. |
| `Badge` | `default`, `secondary`, `outline`, `success`, `warning`, `info`, `destructive`, `primary`. |
| `StatusPill` | Status com ponto: `neutral`, `primary`, `success`, `warning`, `danger`, `whatsapp`. |
| `PageHeader` (`@/components/page`) | `h1` da página, descrição, ações e título da aba do navegador. |
| `EmptyState` / `ErrorState` | Listas vazias, buscas sem resultado e falhas de carregamento, sempre com o próximo passo. |
| `PageSkeleton`, `Skeleton` | Carregamento. Não use textos como "Carregando…" soltos. |
| `ScrollArea` | `orientation="vertical" \| "horizontal" \| "both"`. |
| `getFriendlyErrorMessage` (`@/lib/errors.js`) | Converte erros em frases em pt-BR. Nunca mostre `statusText` ("Not Found"). |

## Glossário de interface

| Use | Evite |
| --- | --- |
| Conversa | Ticket |
| Número (de WhatsApp) | Instância |
| Empresa / código da empresa | Tenant, tenantId, workspace |
| Atendente | Agente, operador |
| Recebida / Enviada | Inbound / Outbound, IN / OUT |
| Diagnóstico | Logs Baileys, payload, broker, JID |
| Lead (item do funil) | Negócio, deal |
| Regra de roteamento (leva os leads de uma origem ao número certo) | Campanha |

## Funil do lead

Uma única lista de etapas no Inbox, no CRM e nas Oportunidades, definida em `packages/contracts/src/lead-stages.ts`
(`LEAD_STAGES`, `LEAD_STAGE_DEFINITIONS`, `canTransitionLeadStage`, `toLeadStage`). Nunca declare etapas em outro lugar.

Novo → Em contato → Qualificação → Proposta → Documentação → Averbação → Liquidação → **Ganho** / **Perdido**, além de **Reciclar** (voltar a oferecer depois).

- O lead é o dono da etapa: mudar no Inbox ou no Kanban atualiza o lead e as conversas abertas do contato.
- "Ganho" é final; "Perdido" só pode ir para "Reciclar".
- A cor de cada etapa vem do campo `tone` da definição (neutral, info, primary, warning, success, danger), aplicada com as classes `*-soft`.
