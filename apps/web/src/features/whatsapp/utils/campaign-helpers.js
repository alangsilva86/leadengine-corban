export const statusMeta = {
  active: { label: 'Ativa', variant: 'success' },
  paused: { label: 'Pausada', variant: 'warning' },
  draft: { label: 'Rascunho', variant: 'info' },
  ended: { label: 'Encerrada', variant: 'secondary' },
  archived: { label: 'Arquivada', variant: 'secondary' },
};

const STATUS_TONE_MAP = {
  active: 'success',
  paused: 'warning',
  draft: 'info',
  ended: 'neutral',
  archived: 'neutral',
};

export const getCampaignStatusTone = (status) => STATUS_TONE_MAP[status] ?? 'neutral';

export const formatNumber = (value) =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(value ?? 0);
