# Relatório de contraste – Fevereiro/2025

## Escopo
- `NoticeBanner` (estados success e warning).
- Badges e chips utilizados nas telas Dashboard, Leads Inbox e Chat Command Center.
- Fluxos críticos: Dashboard, Leads Inbox, Chat Command Center.

## Alterações principais
- `NoticeBanner` agora utiliza tokens semânticos `bg-success-soft`, `text-success-strong`, `bg-warning-soft` e `text-warning-strong`, garantindo contraste AA em temas claro e escuro.
- Tipografia mínima dos badges/chips elevada para `12px` (`text-xs`).

## Medições de contraste
Os novos pares de cor foram avaliados via script de luminância relativa conforme WCAG 2.2:

| Contexto | Contraste |
| --- | --- |
| NoticeBanner success (tema claro) | 8.30:1 |
| NoticeBanner success (tema escuro) | 10.77:1 |
| NoticeBanner warning (tema claro) | 6.37:1 |
| NoticeBanner warning (tema escuro) | 9.57:1 |

## Auditoria automatizada
Tentativa de execução do `@axe-core/cli` contra o build de preview (`vite preview`) falhou por ausência do binário do Chrome no ambiente de CI utilizado.

```bash
pnpm dlx @axe-core/cli http://localhost:4173/
# SessionNotCreatedError: cannot find Chrome binary
```

> Recomendações:
> - Disponibilizar Chrome/Chromium no ambiente de CI para permitir a execução completa do axe.
> - Reexecutar a auditoria via axe DevTools quando disponível um ambiente com navegador.

