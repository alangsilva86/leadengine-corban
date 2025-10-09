# Relatório de tamanho do CSS

Este projeto gera automaticamente um relatório com o tamanho dos bundles CSS para ajudar a manter o carregamento rápido da aplicação web.

## Como gerar o relatório localmente

1. Certifique-se de ter instalado as dependências com `pnpm install`.
2. Execute o comando:

   ```bash
   pnpm build:css-report
   ```

   O script executa o build completo (`pnpm build`) com sourcemaps habilitados apenas para essa análise. Quando os mapas estão disponíveis, ele usa o `source-map-explorer` para montar um treemap. Caso não haja sourcemaps, aplica automaticamente o fallback para [`analyze-css`](https://github.com/macbre/analyze-css) e gera um resumo tabular com as principais métricas.

3. Após a conclusão, abra os arquivos gerados em `apps/web/dist/reports/`:

   - `css-report.html`: visualização interativa (treemap) quando houver sourcemaps ou um relatório tabular com métricas do `analyze-css` quando não houver mapas disponíveis.
   - `css-report.json`: resumo textual com os tamanhos (em bytes e kB), o tipo de análise usada e detalhes dos 10 maiores trechos de cada bundle (ou métricas agregadas no fallback).

## Orçamento e alertas

- O orçamento padrão é de **200 kB gzip** para a soma de todos os bundles CSS. Este limite pode ser ajustado definindo a variável de ambiente `CSS_BUNDLE_BUDGET_KB` antes de rodar o script.
- Se o limite for excedido, o script finaliza com código de saída diferente de zero, fazendo a pipeline falhar e exibindo uma mensagem com o tamanho total calculado.
- O relatório sempre é escrito antes da validação do orçamento, garantindo que você possa inspecioná-lo mesmo quando o build falha.

## Integração com CI

O workflow `ci` executa `pnpm build:css-report` em todos os PRs. Os artefatos `css-report.html` e `css-report.json` são anexados automaticamente à execução para facilitar a análise no GitHub Actions.

## Quando agir

- **Acionamento automático**: sempre que a pipeline falhar com a mensagem “Orçamento excedido”, investigue o relatório para entender quais componentes adicionaram mais peso.
- **Acompanhamento manual**: mesmo quando o build passa, monitore a tendência de crescimento. Se o total se aproximar de 180–190 kB, planeje ajustes antes que o limite seja atingido.

### Estratégias de redução

- Remova estilos não utilizados ou duplicados (por exemplo, via pruning de componentes descontinuados).
- Avalie dividir páginas muito grandes em rotas/partes com carregamento dinâmico, reduzindo CSS inicial.
- Prefira utilitários Tailwind ou classes compartilhadas em vez de regras específicas redundantes.
- Verifique dependências externas que injetam grandes quantidades de CSS (bibliotecas UI, animações) e importe apenas os módulos necessários.

Manter o CSS dentro do orçamento garante carregamento consistente e reduz regressões de performance percebida pelos usuários.
