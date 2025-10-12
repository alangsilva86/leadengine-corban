# ADR 0002: Higienização inicial de dependências do monorepo

- Status: Aceita
- Data: 2025-02-14

## Contexto
Durante a preparação da Fase 0 percebemos que a instalação do workspace falhava por conflitos de peer dependencies. O pacote `eslint-plugin-tailwindcss` exigia Tailwind CSS ^3.4 enquanto a base já opera com Tailwind 4.x. Além disso, `react-day-picker@8` depende de versões antigas de React e `date-fns`, quebrando a resolução quando usamos React 19 e date-fns 4.

## Decisão
Removemos `eslint-plugin-tailwindcss`, que não era mais referenciado na configuração do ESLint, eliminando o conflito com Tailwind 4. Também atualizamos `react-day-picker` para a série ^9.11, que é compatível com React >=16.8 e já utiliza `date-fns` 4 como dependência oficial. A decisão mantém o lint estável e garante que o workspace instale sem travar em peers desatualizados.

## Consequências
Com a limpeza dos peers críticos, `pnpm -w install` volta a concluir sem erros, desbloqueando a execução dos comandos de auditoria da Fase 0. Passamos a ter uma base mais previsível para evoluir as tipagens e refatorações planejadas, além de documentar o racional para futuras revisões de plugins Tailwind ou bibliotecas de calendário.
