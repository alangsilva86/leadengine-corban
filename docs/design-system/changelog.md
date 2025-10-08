# Changelog do design system

## [Unreleased]

### Alterado
- Documentação dos tokens reorganizada em `tokens.md`, com descrição de intenções, valores claro/escuro e principais consumidores.
- Variáveis CSS de sombras (`--shadow-xs` a `--shadow-xl`) expostas em `apps/web/src/styles/theme.css`, garantindo fallback via `theme()` para ambientes sem Tailwind.
- Componentes `Card`, `Button` e `Chart` migrados para tokens do design system, removendo valores hexadecimais/RGBA legados. Em casos de sombra e estados _ghost_, os estilos foram reescritos com `color-mix()` utilizando as novas variáveis para preservar contraste entre temas.
