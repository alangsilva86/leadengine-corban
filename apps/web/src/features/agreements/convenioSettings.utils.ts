import type { Agreement } from './useConvenioCatalog.ts';

export const formatDate = (value: Date) =>
  value.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

export const toInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const generateId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2)}`;

export const resolveProviderId = (metadata: Agreement['metadata'] | null | undefined) => {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  const providerId = metadata.providerId;
  if (typeof providerId !== 'string') {
    return null;
  }

  const trimmed = providerId.trim();
  return trimmed.length ? trimmed : null;
};

export const getErrorMessage = (error: unknown, fallback: string) => {
  const payloadError = (error as { payload?: { error?: { message?: string; code?: string } } })?.payload?.error;

  if (payloadError?.code === 'AGREEMENT_SLUG_CONFLICT') {
    return payloadError.message ?? 'Slug já em uso. Atualize o nome do convênio antes de salvar.';
  }

  return payloadError?.message ?? (error instanceof Error ? error.message : fallback);
};
