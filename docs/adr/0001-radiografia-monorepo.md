# ADR 0001: Radiografia inicial do monorepo

- Status: Aceita
- Data: 2025-02-14

## Contexto
Iniciamos a fase de diagnóstico para alinhar como o monorepo Ticketz LeadEngine está organizado. Precisávamos registrar a estrutura atual, destacando a separação entre apps de produto, pacotes compartilhados e documentação para que futuras evoluções partam de uma radiografia comum.

## Decisão
Validamos que o monorepo continuará organizado com workspaces PNPM, mantendo as aplicações em `apps/` (API, Web e Admin futuro) e bibliotecas reutilizáveis em `packages/`. A documentação permanece centralizada em `docs/`, agora com ADRs versionados para capturar decisões futuras.

## Consequências
A equipe passa a ter um ponto único para consultar o estado atual da arquitetura, reduzindo divergências na comunicação. Novas decisões deverão referenciar esta radiografia para garantir coerência com a organização existente e facilitar o rastreio histórico das mudanças.
