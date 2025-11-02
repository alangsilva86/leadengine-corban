import type { CrmMetricTrend, CrmMetricUnit } from '../state/metrics';

const numberFormatter = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const percentageFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
});

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

const minutesToDuration = (minutes: number) => {
  if (!Number.isFinite(minutes) || minutes < 0) {
    return '–';
  }
  if (minutes < 60) {
    return `${Math.round(minutes)} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remaining = Math.round(minutes % 60);
  if (remaining === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${remaining}min`;
};

export const formatMetricValue = (value: number, unit: CrmMetricUnit): string => {
  switch (unit) {
    case 'count':
      return numberFormatter.format(value);
    case 'percentage':
      return percentageFormatter.format(value / 100);
    case 'currency':
      return currencyFormatter.format(value);
    case 'duration':
      return minutesToDuration(value);
    default:
      return decimalFormatter.format(value);
  }
};

export const formatDeltaLabel = (delta: number | null | undefined, unit: CrmMetricUnit | 'percentage'): string | null => {
  if (delta == null || Number.isNaN(delta)) {
    return null;
  }

  if (unit === 'percentage') {
    const formatted = percentageFormatter.format(delta / 100);
    return delta > 0 ? `+${formatted}` : formatted;
  }

  switch (unit) {
    case 'count': {
      const formatted = numberFormatter.format(Math.abs(delta));
      return delta > 0 ? `+${formatted}` : delta < 0 ? `-${formatted}` : formatted;
    }
    case 'currency': {
      const formatted = currencyFormatter.format(Math.abs(delta));
      return delta > 0 ? `+${formatted}` : delta < 0 ? `-${formatted}` : formatted;
    }
    case 'duration': {
      const formatted = minutesToDuration(Math.abs(delta));
      return delta > 0 ? `+${formatted}` : delta < 0 ? `-${formatted}` : formatted;
    }
    default: {
      const formatted = decimalFormatter.format(Math.abs(delta));
      return delta > 0 ? `+${formatted}` : delta < 0 ? `-${formatted}` : formatted;
    }
  }
};

export const inferTrend = (delta: number | null | undefined): CrmMetricTrend => {
  if (delta == null || delta === 0) {
    return 'flat';
  }
  return delta > 0 ? 'up' : 'down';
};
