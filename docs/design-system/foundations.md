# Design System Foundations

Esta documentação consolida os tokens de design, diretrizes tipográficas e requisitos de contraste que orientam o desenvolvimento de interfaces acessíveis. Ela complementa os arquivos técnicos (`tokens.md`, inventário de cores, auditorias) com uma visão prática para designers e desenvolvedores.

## Tokens de cor

| Token | Uso recomendado | Valor atual | Antes |
| --- | --- | --- | --- |
| `color.primary.default` | Ações principais (botões, links de destaque) | `#0054E6` | `#1476FF` (contraste insuficiente em fundos claros) |
| `color.primary.hover` | Estados hover de ações primárias | `#0039A6` | `#0F5BCC` |
| `color.surface.base` | Fundos de cartões e painéis | `#FFFFFF` | `#F8FAFF` (causava baixo contraste com texto cinza) |
| `color.feedback.success` | Alertas e badges de sucesso | `#1A8F5C` | `#20C997` |

> **Antes/Depois:** A substituição dos tons vibrantes anteriores garante contraste mínimo de 4.5:1 com `color.text.primary` e reduz inconsistências entre componentes. Veja detalhes adicionais no inventário de cores e na auditoria de contraste de fevereiro/2025.

## Tipografia

| Token tipográfico | Elemento | Peso | Tamanho/Linha | Observações |
| --- | --- | --- | --- | --- |
| `font.heading.1` | Títulos de página | SemiBold | 32px / 40px | Substitui `DisplayXL` para melhorar hierarquia em telas menores |
| `font.heading.2` | Cabeçalhos de seção | SemiBold | 24px / 32px | Mantém contraste com `font.body` via espaçamento adicional |
| `font.body` | Texto padrão | Regular | 16px / 24px | Valor mínimo para garantir legibilidade em desktop e mobile |
| `font.caption` | Legendas e metadados | Medium | 14px / 20px | Evitar uso abaixo de 13px para manter contraste perceptível |

> **Antes/Depois:** As headings anteriores (`DisplayXXL` 40px/48px) foram substituídas para reduzir scroll e melhorar o fluxo de leitura. Textos abaixo de 14px devem ser evitados, exceto quando acompanhados de recursos assistivos (tooltip, texto alternativo).

## Requisitos de contraste

- Cumprir **WCAG 2.1 AA** para textos normais (mínimo 4.5:1) e textos grandes (mínimo 3:1).
- Garantir contraste mínimo de 3:1 para ícones e contornos essenciais.
- Validar combinações críticas:
  - `color.primary.default` sobre `color.surface.base` → 6.2:1 (aprovado).
  - `color.text.inverse` sobre `color.primary.default` → 4.7:1 (aprovado).
  - `color.text.muted` sobre `color.surface.subtle` → 3.3:1 (requer aumento de peso ou uso restrito).

> **Antes/Depois:** O antigo `color.text.inverse` (`#FFFFFF`) sobre `#1476FF` atingia apenas 3.8:1. O ajuste do primário para `#0054E6` eleva o contraste para 4.7:1 sem alterar a identidade visual.

## Checklist de acessibilidade

1. **Foco visível**: cada componente interativo deve expor `outline` ou `box-shadow` com contraste ≥ 3:1 versus o fundo imediato.
2. **Contrast ratio**: verifique textos, ícones e bordas em ferramentas como Stark, Contrast ou Axe.
3. **Tamanhos mínimos**:
   - Alvos de toque ≥ 44x44px em dispositivos móveis.
   - Texto padrão ≥ 16px, legendas ≥ 14px com contraste reforçado.
4. **Estados interativos**: documentar hover, active, disabled e focus no Storybook / documentação técnica.
5. **Modo alto contraste**: validar uso dos tokens com inversão de cores para usuários com customizações do SO.
6. **Conteúdo não textual**: fornecer alternativas textuais para ícones isolados e imagens informativas.

> Recomenda-se incluir este checklist na revisão de design e nas pull requests que alteram componentes visuais.

## Próximos passos sugeridos

- Atualizar componentes compartilhados (`Button`, `Banner`, `Card`) para consumir os tokens revisados.
- Criar exemplos no Storybook com comparações "Antes vs Depois" utilizando os novos tokens.
- Instrumentar testes automáticos de contraste via `jest-axe` ou `@storybook/addon-a11y`.

---

**Referências**: [tokens](./tokens.md), [inventário de cores](./color-inventory.md), [auditoria de contraste 02/2025](./contrast-audit-2025-02.md).
