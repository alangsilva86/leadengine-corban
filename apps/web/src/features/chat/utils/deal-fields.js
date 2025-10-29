import { normalizeCurrencyValue, normalizeIntegerValue } from './validation';

const CURRENCY_FORMATTER = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
});

const formatCurrencyField = (value) => {
  const amount = normalizeCurrencyValue(value);

  if (amount === null) {
    return value === null || value === undefined ? '' : String(value);
  }

  return CURRENCY_FORMATTER.format(amount);
};

const formatTermField = (value) => {
  const term = normalizeIntegerValue(value);

  if (term === null) {
    return value === null || value === undefined ? '' : String(value);
  }

  const suffix = term === 1 ? 'mês' : 'meses';
  return `${term} ${suffix}`;
};

export { formatCurrencyField, formatTermField };
