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

export const formatPhoneNumber = (value: unknown): string => {
  if (!value) return '—';
  const digits = `${value}`.replace(/\D/g, '');
  if (digits.length < 10) return `${value}`;
  const ddd = digits.slice(0, 2);
  const nine = digits.length > 10 ? digits.slice(2, 3) : '';
  const prefix = digits.length > 10 ? digits.slice(3, 7) : digits.slice(2, 6);
  const suffix = digits.length > 10 ? digits.slice(7) : digits.slice(6);
  return `(${ddd}) ${nine}${prefix}-${suffix}`;
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

const JID_SUFFIX_PATTERN = /@(s\.whatsapp\.net|c\.us|lid|g\.us)$/i;

/**
 * Remove o sufixo técnico do WhatsApp ("@s.whatsapp.net") e o identificador de aparelho (":12").
 * Retorna apenas os dígitos do número, ou `null` quando não há número utilizável.
 */
export const extractPhoneDigits = (value: unknown): string | null => {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }
  const raw = `${value}`.trim().replace(JID_SUFFIX_PATTERN, '');
  const withoutDevice = raw.includes(':') ? raw.slice(0, raw.indexOf(':')) : raw;
  const digits = withoutDevice.replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
};

/**
 * Formata um número de WhatsApp para exibição: "+55 11 91234-5678".
 * Nunca devolve o identificador técnico (JID); retorna `null` quando não há número.
 */
export const formatWhatsAppNumber = (value: unknown): string | null => {
  const digits = extractPhoneDigits(value);
  if (!digits) {
    return null;
  }

  const national = digits.startsWith('55') && (digits.length === 12 || digits.length === 13) ? digits.slice(2) : null;
  const brazilian = national ?? (digits.length === 10 || digits.length === 11 ? digits : null);

  if (brazilian) {
    const ddd = brazilian.slice(0, 2);
    const rest = brazilian.slice(2);
    const splitAt = rest.length - 4;
    return `+55 ${ddd} ${rest.slice(0, splitAt)}-${rest.slice(splitAt)}`;
  }

  return `+${digits}`;
};

const RELATIVE_UNITS: Array<{ unit: Intl.RelativeTimeFormatUnit; seconds: number }> = [
  { unit: 'year', seconds: 60 * 60 * 24 * 365 },
  { unit: 'month', seconds: 60 * 60 * 24 * 30 },
  { unit: 'week', seconds: 60 * 60 * 24 * 7 },
  { unit: 'day', seconds: 60 * 60 * 24 },
  { unit: 'hour', seconds: 60 * 60 },
  { unit: 'minute', seconds: 60 },
];

/** "há 5 minutos", "ontem", "agora mesmo". Retorna `null` para datas inválidas. */
export const formatRelativeTime = (value: unknown, now: number = Date.now()): string | null => {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value as string | number);
  const time = date.getTime();
  if (Number.isNaN(time)) {
    return null;
  }

  const diffSeconds = Math.round((time - now) / 1000);
  if (Math.abs(diffSeconds) < 60) {
    return 'agora mesmo';
  }

  const formatter = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
  for (const { unit, seconds } of RELATIVE_UNITS) {
    if (Math.abs(diffSeconds) >= seconds) {
      return formatter.format(Math.round(diffSeconds / seconds), unit);
    }
  }
  return 'agora mesmo';
};
