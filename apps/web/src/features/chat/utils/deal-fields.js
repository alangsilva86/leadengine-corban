const CURRENCY_FORMATTER = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
});

const normalizeCurrencyValue = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const text = String(value).trim();

  if (!text) {
    return null;
  }

  const cleaned = text.replace(/\s+/g, '').replace(/[^0-9,.-]/g, '');

  if (!cleaned) {
    return null;
  }

  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');

  let normalized = cleaned;

  if (hasComma && hasDot) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (hasComma && !hasDot) {
    normalized = cleaned.replace(',', '.');
  }

  const amount = Number.parseFloat(normalized);

  return Number.isNaN(amount) ? null : amount;
};

const normalizeIntegerValue = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }

  const digits = String(value).replace(/\D+/g, '');

  if (!digits) {
    return null;
  }

  const normalized = Number.parseInt(digits, 10);

  return Number.isNaN(normalized) ? null : normalized;
};

const normalizeTextValue = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();
  return text.length > 0 ? text : null;
};

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

export {
  formatCurrencyField,
  formatTermField,
  normalizeCurrencyValue,
  normalizeIntegerValue,
  normalizeTextValue,
};

