const POLL_PLACEHOLDER_MESSAGE_VALUES = [
  '[Mensagem recebida via WhatsApp]',
  '[Mensagem]',
] as const;

export const POLL_PLACEHOLDER_MESSAGES = new Set<string>(POLL_PLACEHOLDER_MESSAGE_VALUES);

export const normalizeTextValue = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const normalized = value.toString().trim();
    return normalized.length > 0 ? normalized : null;
  }

  return null;
};

export const getFirstNonEmptyString = (...candidates: unknown[]): string | null => {
  for (const candidate of candidates) {
    const normalized = normalizeTextValue(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return null;
};

export const getFirstInteger = (...candidates: unknown[]): number | null => {
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isInteger(candidate)) {
      return candidate;
    }
  }

  return null;
};

export const dedupeNormalizedStrings = (values: Iterable<unknown>): string[] => {
  const unique = new Set<string>();

  for (const value of values) {
    const normalized = normalizeTextValue(value);
    if (normalized) {
      unique.add(normalized);
    }
  }

  return Array.from(unique.values());
};

export const isPollPlaceholderText = (value: unknown): boolean => {
  const normalized = normalizeTextValue(value);
  if (!normalized) {
    return false;
  }

  return POLL_PLACEHOLDER_MESSAGES.has(normalized);
};
