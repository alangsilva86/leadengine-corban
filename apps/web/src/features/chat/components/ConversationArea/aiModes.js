const AI_MODE_OPTIONS = [
  {
    value: 'assist',
    label: 'IA assistida',
    shortLabel: 'Assistida',
    description: 'Receba sugestões da IA e confirme manualmente cada mensagem.',
  },
  {
    value: 'auto',
    label: 'IA autônoma',
    shortLabel: 'Autônoma',
    description: 'Permita que a IA responda automaticamente aos contatos.',
  },
  {
    value: 'manual',
    label: 'Agente no comando',
    shortLabel: 'Manual',
    description: 'Desativa respostas automáticas para atuar de forma 100% manual.',
  },
];

const DEFAULT_AI_MODE = AI_MODE_OPTIONS[0].value;

const isValidAiMode = (value) => AI_MODE_OPTIONS.some((option) => option.value === value);

const getAiModeOption = (value) => AI_MODE_OPTIONS.find((option) => option.value === value) ?? AI_MODE_OPTIONS[0];

export { AI_MODE_OPTIONS, DEFAULT_AI_MODE, getAiModeOption, isValidAiMode };
