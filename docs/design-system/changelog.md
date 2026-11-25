# Changelog do design system

## [Unreleased]

### Refatoração de experiência (novembro de 2026)
- Paleta única (`--ds-*`) com marca azul cobalto; o verde do WhatsApp passa a identificar só o canal.
- Corrigida a cadeia de tons: selos de sucesso, informação e neutro tinham contraste de 1,2:1.
- 224 classes que não geravam CSS no Tailwind 4 (`bg-surface-overlay-*`, `border-surface-overlay-glass-border`) voltaram a funcionar.
- `dark:` passa a seguir o tema escolhido no app, não o do sistema operacional.
- Superfícies opacas, sem vidro e desfoque; sombras discretas; `prefers-reduced-motion` respeitado globalmente.
- Novos primitivos: `PageHeader`, `EmptyState`, `ErrorState`, `PageSkeleton`; `Button` ganhou variante `soft` e tamanhos compactos.

### Alterado
- Documentação dos tokens reorganizada em `tokens.md`, com descrição de intenções, valores claro/escuro e principais consumidores.
- Variáveis CSS de sombras (`--shadow-xs` a `--shadow-xl`) expostas em `apps/web/src/styles/theme.css`, garantindo fallback via `theme()` para ambientes sem Tailwind.
- Componentes `Card`, `Button` e `Chart` migrados para tokens do design system, removendo valores hexadecimais/RGBA legados. Em casos de sombra e estados _ghost_, os estilos foram reescritos com `color-mix()` utilizando as novas variáveis para preservar contraste entre temas.
