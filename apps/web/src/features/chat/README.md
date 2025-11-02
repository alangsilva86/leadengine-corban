# Chat

## Convenção de sanitização da linha do tempo da IA

Toda interação com os serviços de IA (sugestões, streaming de resposta e contexto no composer)
deve utilizar **a mesma rotina de sanitização** localizada em
[`utils/aiTimeline.js`](./utils/aiTimeline.js). Esse utilitário garante que:

- Somente as últimas 50 entradas são consideradas, respeitando os mesmos limites em todos os fluxos.
- O conteúdo e o papel de cada mensagem são extraídos de forma consistente (priorizando `content`, `text`,
  `body`, `message` e `messageText`).
- A carga enviada ao backend mantém o formato histórico esperado, evitando regressões ao adicionar novos campos.

Sempre que uma nova integração precisar consumir o histórico da conversa, reutilize as funções exportadas pelo
utilitário em vez de reimplementar a lógica de sanitização.
