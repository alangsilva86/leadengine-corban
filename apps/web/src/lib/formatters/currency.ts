const sanitizeNumericString = (value: string) =>
  value
    .replace(/[^0-9,-.]+/g, '')
    .replace(/\.(?=.*\.)/g, '')
    .replace(',', '.');

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'bigint') {
    return Number(value);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = Number.parseFloat(sanitizeNumericString(trimmed));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const applyRounding = (value: number, mode: FormatCurrencyOptions['roundingMode'], precision: number) => {
  if (!mode) {
    return value;
  }

  const factor = Number.isFinite(precision) && precision >= 0 ? 10 ** precision : 1;
  const scaled = value * factor;
  switch (mode) {
    case 'floor':
      return Math.floor(scaled) / factor;
    case 'ceil':
      return Math.ceil(scaled) / factor;
    case 'trunc':
      return Math.trunc(scaled) / factor;
    case 'round':
    default:
      return Math.round(scaled) / factor;
  }
};

export type FormatCurrencyOptions = {
  locale?: string;
  currency?: string;
  fallback?: string | null;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  roundingMode?: 'round' | 'floor' | 'ceil' | 'trunc';
  roundingPrecision?: number;
};

const DEFAULT_OPTIONS: Required<Pick<FormatCurrencyOptions, 'locale' | 'currency' | 'fallback'>> = {
  locale: 'pt-BR',
  currency: 'BRL',
  fallback: '--',
};

export const formatCurrency = (value: unknown, options: FormatCurrencyOptions = {}) => {
  const { locale, currency, fallback } = { ...DEFAULT_OPTIONS, ...options };
  const {
    minimumFractionDigits,
    maximumFractionDigits,
    roundingMode,
    roundingPrecision = 2,
  } = options;

  if (value === null || value === undefined || value === '') {
    return fallback ?? '';
  }

  const numericValue = toNumber(value);
  if (numericValue === null) {
    return fallback ?? '';
  }

  const rounded = roundingMode ? applyRounding(numericValue, roundingMode, roundingPrecision) : numericValue;

  const formatterOptions: Intl.NumberFormatOptions = {
    style: 'currency',
    currency,
  };

  if (typeof minimumFractionDigits === 'number') {
    formatterOptions.minimumFractionDigits = minimumFractionDigits;
  }
  if (typeof maximumFractionDigits === 'number') {
    formatterOptions.maximumFractionDigits = maximumFractionDigits;
  }

  return new Intl.NumberFormat(locale, formatterOptions).format(rounded);
};

export default formatCurrency;
