import StageProgress from './StageProgress.jsx';

const meta = {
  title: 'Features/Chat/Conversation Header/StageProgress',
  component: StageProgress,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Stepper horizontal utilizado no cabeçalho da conversa para exibir a etapa atual do funil e os próximos passos. O componente lê os metadados do funil definidos em `stage.js`, mantendo consistência visual com o PrimaryActionBanner.',
      },
    },
  },
  argTypes: {
    currentStage: {
      control: 'text',
      description:
        'Nome da etapa (qualquer formato). O componente normaliza o valor e usa `STAGE_LABELS`/`STAGE_PRESENTATION` para montar os passos.',
    },
  },
};

export default meta;

export const Proposta = {
  args: {
    currentStage: 'Proposta',
  },
};

export const Liquidacao = {
  args: {
    currentStage: 'Liquidação',
  },
};

export const EtapaDesconhecida = {
  args: {
    currentStage: 'Etapa surpresa',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Quando recebe um estágio fora do funil mapeado, o componente aplica um fallback acessível e mantém a trilha composta apenas pela etapa atual.',
      },
    },
  },
};
