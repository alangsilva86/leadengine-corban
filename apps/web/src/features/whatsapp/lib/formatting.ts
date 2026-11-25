export const formatMetricValue = (value: unknown): string => {
  if (typeof value === 'number') {
    return value.toLocaleString('pt-BR');
  }
  if (typeof value === 'string' && value.trim() !== '') {
    return value;
  }
  return '—';
};

export const formatTimestampLabel = (value: unknown): string => {
  if (!value) {
    return '—';
  }

  const date = new Date(value as any);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  try {
    return date.toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return date.toISOString();
  }
};

export const humanizeLabel = (value: unknown): string => {
  if (typeof value !== 'string' || !value.trim()) {
    return 'Atualização';
  }

  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
};
