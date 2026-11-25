import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/** Tempo relativo em pt-BR (fonte única do web). Todas devolvem `null` para datas inválidas. */

type DateInput = string | number | Date | null | undefined;

export const toDate = (value: DateInput): Date | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
};

/** Compacto, para listas: "agora", "há 5 min", "há 3 h", "há 2 d", depois a data curta ("12 de jun."). */
export const formatRelativeShort = (value: DateInput, now = Date.now()): string | null => {
  const date = toDate(value);
  if (!date) return null;
  const diffMinutes = Math.max(0, Math.floor((now - date.getTime()) / 60_000));
  if (diffMinutes < 1) return 'agora';
  if (diffMinutes < 60) return `há ${diffMinutes} min`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `há ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `há ${diffDays} d`;
  return format(date, "d 'de' MMM", { locale: ptBR });
};

/** Por extenso (date-fns): "há 5 minutos", "há cerca de 2 horas". */
export const formatRelativeLong = (value: DateInput): string | null => {
  const date = toDate(value);
  if (!date) return null;
  return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
};

const RELATIVE_UNITS: Array<{ unit: Intl.RelativeTimeFormatUnit; seconds: number }> = [
  { unit: 'year', seconds: 60 * 60 * 24 * 365 },
  { unit: 'month', seconds: 60 * 60 * 24 * 30 },
  { unit: 'week', seconds: 60 * 60 * 24 * 7 },
  { unit: 'day', seconds: 60 * 60 * 24 },
  { unit: 'hour', seconds: 60 * 60 },
  { unit: 'minute', seconds: 60 },
];

/** Natural (Intl): "há 5 minutos", "ontem", "agora mesmo". */
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
