# Conversation header

O cabeçalho da conversa é renderizado por `apps/web/src/features/chat/components/ConversationArea/ConversationHeader.jsx` e concentra os principais indicadores do ticket aberto. A partir desta versão, o cabeçalho inclui o componente `StageProgress`, responsável por apresentar a etapa atual do funil e os próximos passos de forma resumida.

## StageProgress

- Localização: `apps/web/src/features/chat/components/ConversationArea/StageProgress.jsx`.
- O componente consome `STAGE_LABELS` e `STAGE_PRESENTATION` definidos em `utils/stage.js`, garantindo que quaisquer ajustes no funil sejam refletidos automaticamente no stepper.
- A API expõe a prop `currentStage`, que aceita valores livres. O valor é normalizado por `normalizeStage` antes de montar a trilha.
- O primeiro cartão recebe `aria-current="step"` e um rótulo acessível do tipo `Etapa atual: <nome>`. As próximas etapas usam o prefixo `Próxima etapa`, facilitando a navegação por leitores de tela.
- Em telas pequenas o layout empilha os cartões verticalmente; a partir do breakpoint `sm` o stepper passa a ser horizontal.

### Integração com o PrimaryActionBanner

`PrimaryActionBanner.jsx` injeta o `StageProgress` logo abaixo do título do lead. Para que o stepper seja renderizado basta fornecer a prop `stageKey` (já normalizada) ao banner — a tipagem de `ConversationHeader.jsx` garante o repasse automático do valor retornado por `useTicketStageInfo`.

#### Boas práticas

1. Prefira repassar a chave normalizada (`stageKey`) em vez do label humanizado.
2. Não sobrescreva manualmente os estilos do stepper; em casos especiais, utilize `className` para ajustar o espaçamento externo.
3. Ao adicionar novas etapas no funil, atualize `STAGE_LABELS`/`STAGE_PRESENTATION`; o `StageProgress` refletirá a mudança sem necessitar ajustes adicionais.
