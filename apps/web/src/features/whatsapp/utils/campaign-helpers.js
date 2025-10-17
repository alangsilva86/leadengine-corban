export const statusMeta = {
  active: { label: 'Ativa', variant: 'success' },
  paused: { label: 'Pausada', variant: 'warning' },
  draft: { label: 'Rascunho', variant: 'info' },
  ended: { label: 'Encerrada', variant: 'secondary' },
};

export const formatNumber = (value) =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(value ?? 0);
