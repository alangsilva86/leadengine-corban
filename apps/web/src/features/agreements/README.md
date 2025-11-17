# Agreements

## Seletores reutilizáveis do catálogo de convênios

Os componentes que dependem do catálogo de convênios agora podem reaproveitar as funções puras
exportadas por [`agreementsSelectors.ts`](./agreementsSelectors.ts):

```ts
import {
  toAgreementOptions,
  getProductsByAgreement,
  findActiveWindow,
  getActiveRates,
} from '@/features/agreements/agreementsSelectors.ts';
```

- `toAgreementOptions(convenios)` normaliza os registros retornados pela API para uma lista com
  `value`, `label` e produtos disponíveis.
- `getProductsByAgreement(options)` devolve um `Map` com os produtos normalizados por convênio, útil
  para selects dependentes.
- `findActiveWindow(agreement, simulationDate)` resolve a janela válida para a data escolhida.
- `getActiveRates(agreement, productId, simulationDate)` retorna apenas as taxas ativas para o
  produto selecionado, já aplicando os filtros de status e vigência.

O hook [`useConvenioCatalog`](./useConvenioCatalog.ts) expõe versões memoizadas dessas coleções
(`agreementOptions` e `productsByAgreement`). Se um componente precisar apenas desses derivados,
utilize os helpers `useAgreementOptions()` e `useAgreementProducts()` exportados pelo mesmo módulo.
Dessa forma, evitamos duplicação de lógica em telas como SimulationModal, DealDrawer e UI de
configuração.

## Monitoramento de renderizações custosas

Utilize o React DevTools Profiler para garantir que o consumo dos seletores esteja evitando renders
extras:

1. Execute `pnpm web:dev` e abra o app em `http://localhost:5173` com o React DevTools instalado.
2. Inicie o Profiler, realize trocas de convênio/produto na SimulationModal e finalize a captura.
3. Compare com um snapshot anterior: após o refactor deste PR, o fluxo de troca de convênio caiu de
   ~11 renders (~120 ms) para ~4 renders (~35 ms) no meu ambiente local.

Ao adicionar novos consumidores, mantenha o mesmo padrão (seletores puros + hooks memoizados) e
registre novas medições no README quando observar reduções relevantes.
