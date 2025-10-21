# Tokens do design system

Este documento consolida os _design tokens_ consumidos pelo LeadEngine. Cada token descreve uma intenção de design e oferece valores para os temas claro/escuro expostos via CSS Custom Properties em `apps/web/src/styles/theme.css`. A tabela também aponta os principais componentes que utilizam cada token para facilitar a rastreabilidade.

## Como aplicar tokens semânticos no Tailwind

1. **Localize o propósito visual.** Use as tabelas abaixo para descobrir se o elemento representa conteúdo, superfície, borda, feedback etc. Prefira sempre o token cuja descrição melhor traduz a intenção de design.
2. **Mapeie para uma utility semântica.** O arquivo `apps/web/tailwind.config.ts` gera classes como `textForeground`, `bgSurface`, `borderSurfaceGlassBorder` e `bgSurfaceOverlayQuiet` diretamente a partir dos tokens. Combine-as com utilidades padrão do Tailwind (`rounded-lg`, `flex`, `gap-4`...) para montar o layout.
3. **Falhou ao encontrar o token certo?** Consulte `docs/design-system/color-inventory.md` para exemplos visuais e abra uma issue em `#design-system` antes de recorrer a valores arbitrários.
4. **Valide com o lint.** `pnpm lint` executa a regra `no-forbidden-tailwind-colors`, que bloqueia classes `text-slate-*`, `bg-white/[...]` e `border-white/...`. Ajuste a implementação até o lint passar sem precisar de exceções.

> 💡 _Dica rápida_: quando precisar de tokens em contextos dinâmicos (`clsx`, `cva`, `class-variance-authority`), basta usar o mesmo nome das utilities (`textForeground`, `bgSurfaceStrong`, `borderMuted`). A regra de lint analisa literais dentro desses helpers automaticamente.

## Cores

### Superfícies

| Token (`colors.surface.*`) | Propósito | Valor (Light) | Valor (Dark) | Componentes consumidores |
| --- | --- | --- | --- | --- |
| `canvas` | Plano de fundo principal da aplicação, aplicado ao `<body>` e wrappers globais. | `#f8fafc` | `#0f172a` | `App.css`, shells do ChatCommandCenter (`QueueList`, `ConversationArea`) |
| `overlay.quiet` | Camada translúcida para cards e seções secundárias. | `rgba(255, 255, 255, 0.78)` | `rgba(124, 138, 163, 0.14)` | `Card`, `InboxHeader`, mosaicos do dashboard |
| `overlay.bold` | Sobreposição com maior contraste para popovers e modais. | `rgba(255, 255, 255, 0.92)` | `rgba(124, 138, 163, 0.22)` | `Popover`, `Dashboard` (painéis com foco em dados) |
| `overlay.glass.layer` | Fundo “glassmorphism” usado em superfícies com blur. | `rgba(255, 255, 255, 0.85)` | `rgba(148, 163, 184, 0.08)` | `Composer`, `InboxAppShell`, `ChatCommandCenter` |
| `overlay.glass.border` | Bordas de superfícies em vidro e estados de foco correlatos. | `rgba(15, 23, 42, 0.12)` | `rgba(148, 163, 184, 0.25)` | `Card`, `ChatCommandCenter`, `WhatsAppConnect` |
| `overlay.inbox.quiet` | Plano de fundo padrão das listas de conversas. | `rgba(255, 255, 255, 0.72)` | `rgba(15, 23, 42, 0.78)` | `QueueList`, cartões da inbox |
| `overlay.inbox.bold` | Realce para estados ativos dentro da inbox. | `rgba(255, 255, 255, 0.88)` | `rgba(15, 23, 42, 0.9)` | `QueueList` (estados ativos e hover) |

### Conteúdo

| Token (`colors.content.*`) | Propósito | Valor (Light) | Valor (Dark) | Componentes consumidores |
| --- | --- | --- | --- | --- |
| `primary` | Texto principal em superfícies padrão. | `#0f172a` | `#f1f5f9` | Tipografia global (`App.css`), `Card`, `Dashboard` |
| `muted` | Texto desativado e rótulos secundários. | `#475569` | `#94a3b8` | `Badge`, `CardDescription`, filtros da inbox |
| `inbox.primary` | Texto em cartões e listas da inbox. | `#0f172a` | `rgba(241, 245, 249, 0.92)` | `QueueList`, `ConversationArea` |
| `inbox.muted` | Texto auxiliar dentro da inbox. | `rgba(15, 23, 42, 0.6)` | `rgba(241, 245, 249, 0.75)` | `QueueList`, `ConversationArea` |

### Traços

| Token (`colors.stroke.*`) | Propósito | Valor (Light) | Valor (Dark) | Componentes consumidores |
| --- | --- | --- | --- | --- |
| `divider` | Linhas de separação sutis entre blocos. | `rgba(15, 23, 42, 0.08)` | `rgba(124, 138, 163, 0.35)` | `App.css` (`.section-divider`), tabelas do dashboard |
| `default` | Bordas padrão de cartões, inputs e painéis. | `rgba(15, 23, 42, 0.12)` | `#7c8aa3` | `Card`, `Button` (outline), `glass-surface` |
| `input` | Delimitação de campos interativos. | `rgba(15, 23, 42, 0.18)` | `#7c8aa3` | `Input`, `Textarea`, `Select` |
| `inbox` | Bordas específicas da área de atendimento. | `rgba(15, 23, 42, 0.12)` | `rgba(255, 255, 255, 0.12)` | `QueueList`, divisórias do `ChatCommandCenter` |

### Marca e suporte

| Token | Propósito | Valor (Light) | Valor (Dark) | Componentes consumidores |
| --- | --- | --- | --- | --- |
| `brand.primary.solid` | Cor primária para CTAs e gráficos. | `#4f46e5` | `#6366f1` | `Button` (default), `Dashboard` (indicadores) |
| `brand.primary.onSolid` | Texto sobre o primário sólido. | `#eef2ff` | `#f8fafc` | `Button`, ícones acionáveis |
| `brand.primary.soft` | Fundo suave para estados ativos discretos. | `rgba(79, 70, 229, 0.14)` | `rgba(99, 102, 241, 0.2)` | `AgreementGrid` (selo “Convênio ativo”), filtros destacados |
| `brand.primary.softBorder` | Borda/acento de foco para cartões selecionados. | `rgba(79, 70, 229, 0.38)` | `rgba(99, 102, 241, 0.45)` | `AgreementGrid` (card selecionado), indicadores de foco |
| `brand.secondary.surface` | Segundo plano de destaque brando. | `rgba(79, 70, 229, 0.1)` | `rgba(99, 102, 241, 0.12)` | `Badge` secundário, cards do dashboard |
| `brand.secondary.onSurface` | Texto sobre secundário. | `#0f172a` | `#f1f5f9` | `Badge`, cards temáticos |
| `brand.accent.surface` | Fundo de chips e indicadores. | `rgba(79, 70, 229, 0.16)` | `rgba(99, 102, 241, 0.18)` | `StatusBadge`, indicadores da conversa |
| `brand.accent.onSurface` | Texto sobre o accent. | `#0f172a` | `#f1f5f9` | `StatusBadge`, `Dashboard` |
| `tone.info.surface` | Fundo informativo que substitui `bg-primary/10`. | `rgba(79, 70, 229, 0.18)` | `rgba(99, 102, 241, 0.18)` | `AgreementGrid`, `Badge` com `tone="info"` |
| `tone.info.border` | Contorno/anel para estados informativos. | `rgba(79, 70, 229, 0.42)` | `rgba(99, 102, 241, 0.45)` | `AgreementGrid`, indicadores “ativo” |
| `tone.info.foreground` | Texto sobre superfícies informativas. | `#bbc5fc` | `#cad3fd` | `Badge` informativo, selo “Convênio ativo” |
| `support.muted.surface` | Base neutra para estados “muted”. | `rgba(148, 163, 184, 0.16)` | `rgba(148, 163, 184, 0.08)` | `FilterToolbar`, `StatusFilter` |
| `support.muted.onSurface` | Texto sobre superfícies neutras. | `#475569` | `#94a3b8` | `FilterToolbar`, tooltips |

### Feedback

| Token | Propósito | Valor (Light) | Valor (Dark) | Componentes consumidores |
| --- | --- | --- | --- | --- |
| `feedback.success.solid` | Estados de sucesso/confirmado. | `#16a34a` | `#22c55e` | `Badge` (sucesso), métricas positivas |
| `feedback.success.onSoft` | Texto sobre fundos suaves de sucesso. | `#14532d` | `#bbf7d0` | `Dashboard` (cards de conversão), toasts |
| `feedback.success.onStrong` | Texto sobre fundos fortes de sucesso. | `#f0fdf4` | `#022c17` | `Alert` positivo |
| `feedback.warning.solid` | Avisos e estado de atenção. | `#d97706` | `#facc15` | `Alert` de aviso, badges |
| `feedback.warning.onSoft` | Texto sobre o amarelo suave. | `#92400e` | `#fde68a` | Banners de aviso |
| `feedback.error.solid` | Estados de erro. | `#dc2626` | `#ef4444` | `Button` destrutivo, `Alert` crítico |
| `feedback.error.onSoft` | Texto sobre base de erro suave. | `#991b1b` | `#fecaca` | Validadores de formulário |
| `feedback.destructive.solid` | Ações destrutivas (variação do erro). | `#dc2626` | `#ef4444` | `Button` `destructive`, menus contextuais |

### Canais e navegação

| Token | Propósito | Valor (Light) | Valor (Dark) | Componentes consumidores |
| --- | --- | --- | --- | --- |
| `status.whatsapp` | Identidade do canal WhatsApp. | `#25d366` | `#25d366` | `Dashboard` (métricas por canal), `ConversationArea` |
| `data.visualization.categorical.(1-5)` | Paleta para gráficos. | `#4f46e5`, `#0ea5e9`, `#f97316`, `#16a34a`, `#facc15` | `#6366f1`, `#22d3ee`, `#f97316`, `#22c55e`, `#facc15` | `Dashboard`, `Reports`, componentes `Chart` |
| `navigation.sidebar.surface` | Fundo da navegação lateral. | `rgba(255, 255, 255, 0.85)` | `rgba(15, 23, 42, 0.96)` | `InboxAppShell`, painéis laterais |
| `navigation.sidebar.onSurface` | Texto no sidebar. | `#0f172a` | `#f1f5f9` | `InboxAppShell`, menu lateral |
| `navigation.sidebar.primary` | Destaques do sidebar. | `#4f46e5` | `#6366f1` | Itens ativos do menu |
| `navigation.sidebar.onPrimary` | Texto sobre a cor primária do menu. | `#eef2ff` | `#f8fafc` | Botões destacados |
| `navigation.sidebar.accent` | Superfícies auxiliares no menu. | `rgba(79, 70, 229, 0.1)` | `rgba(148, 163, 184, 0.12)` | Cards auxiliares do sidebar |
| `navigation.sidebar.onAccent` | Texto sobre o accent da navegação. | `#0f172a` | `#f1f5f9` | Cards auxiliares do sidebar |
| `navigation.sidebar.border` | Linhas de contorno no menu. | `rgba(15, 23, 42, 0.1)` | `rgba(255, 255, 255, 0.12)` | Painéis laterais |
| `navigation.sidebar.focusRing` | Anel de foco no sidebar. | `rgba(79, 70, 229, 0.25)` | `rgba(99, 102, 241, 0.4)` | Botões do sidebar |

## Espaçamentos e raios

| Token | Propósito | Valor | Componentes consumidores |
| --- | --- | --- | --- |
| `spacing.1 – spacing.8` | Escala de espaçamento reutilizável no layout. | `0.25rem – 2rem` | Utilizada via variáveis `--spacing-*` em `App.css`, `glass-surface`, componentes responsivos |
| `radii.sm – radii.xl` | Cantos arredondados consistentes. | `0.5rem – 1rem` | `Button`, `Card`, shells da inbox |

## Sombras

| Token | Propósito | Valor | Componentes consumidores |
| --- | --- | --- | --- |
| `shadows.xs – shadows.xl` | Elevações graduais para superfícies interativas. | Definidos com `color-mix` a partir de `--color-border`. | `Card`, botões, painéis do dashboard |
| `shadows.brandRing` | Destaque combinado de sombra + halo primário. | `var(--shadow-lg), 0 0 0 1px var(--tone-info-border)` | Cards selecionados (`AgreementGrid`), mosaicos ativos |

> **Fallbacks:** todas as custom properties usam `theme()` do Tailwind com valores padrão definidos em `apps/web/tailwind.tokens.js`. Em ambientes que não carregam a folha de estilos, os valores _hardcoded_ no arquivo de tokens são aplicados automaticamente.

## Exceções temporárias

Algumas áreas legadas ainda dependem da paleta `slate`/`white` para garantir compatibilidade com integrações externas. Elas foram mapeadas em `config/forbidden-tailwind-exceptions.json` e não devem receber novas ocorrências de classes proibidas. Sempre que tocar nesses módulos, planeje a migração para tokens e remova a exceção correspondente.

- `apps/web/src/components/ui/glass-panel.*` — stories do antigo painel de vidro aguardam estabilização do componente definitivo.
- `apps/web/src/features/chat/components/**/*` — fluxo de chat com widgets herdados dependentes de estilos externos.
- `apps/web/src/features/whatsapp/components/**/*` — componentes do conector WhatsApp que compartilham estilos com a SDK do parceiro.
- `apps/web/src/features/whatsapp/WhatsAppConnect.jsx` — onboarding em revisão junto a parceiros comerciais.

## Utilitários de layout e superfície

As classes abaixo residem em `apps/web/src/App.css` dentro de `@layer components` e funcionam como atalhos padronizados que combinam múltiplos tokens. Utilize-as para manter consistência visual entre telas.

| Classe | Descrição | Tokens utilizados | Uso recomendado |
| --- | --- | --- | --- |
| `.app-shell` | Aplica plano de fundo base e cor de texto global sem gradientes. | `colors.surface.canvas`, `colors.content.primary` | Wrapper raiz do layout ou páginas que dispensam efeitos decorativos. |
| `.app-shell--gradient` | Gradiente opcional com realces nas diagonais. | `brand.primary.solid`, `feedback.success.solid` | Combinar com `.app-shell` quando quiser replicar o fundo degradê anterior apenas em páginas específicas. |
| `.glass-surface` | Superfície translúcida com blur e borda suave. | `overlay.glass.layer`, `overlay.glass.border` | Cartões, cabeçalhos e caixas de diálogo com efeito vidro. |
| `.glass-surface--strong` | Variação mais opaca do vidro para contextos com maior contraste. | `overlay.bold`, `colors.stroke.default` | Card dashboards e shells com necessidade de contraste adicional. |
| `.section-divider` | Linha sutil para separar blocos de conteúdo. | `colors.stroke.divider` | `Separator` horizontais em componentes como `WhatsAppConnect`. |
| `.filter-pill`, `.filter-pill--active` | Estilo de chip clicável com estados neutro e ativo. | `colors.stroke.default`, `colors.content.muted`, `brand.primary.onSolid` | Filtros de status e controles de segmentação na inbox. |
