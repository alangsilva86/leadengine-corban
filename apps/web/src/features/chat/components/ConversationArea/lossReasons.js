export const LOSS_REASONS = [
  { value: 'sem_interesse', label: 'Sem interesse' },
  { value: 'orcamento', label: 'Sem orçamento disponível' },
  { value: 'concorrencia', label: 'Fechou com a concorrência' },
  { value: 'documentacao', label: 'Documentação incompleta' },
  { value: 'outro', label: 'Outro' },
];

export const LOSS_REASON_HELPERS = LOSS_REASONS.reduce((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {});

export const resolveLossReasonLabel = (value) => LOSS_REASON_HELPERS[value] ?? null;

export default LOSS_REASONS;
