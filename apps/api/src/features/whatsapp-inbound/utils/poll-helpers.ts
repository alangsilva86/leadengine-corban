import type { PollChoiceSelectedOptionPayload } from '../schemas/poll-choice';

const POLL_PLACEHOLDER_MESSAGES = new Set(['[Mensagem recebida via WhatsApp]', '[Mensagem]']);

export const sanitizeOptionText = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const extractPollOptionLabel = (option: PollChoiceSelectedOptionPayload): string | null => {
  return (
    sanitizeOptionText(option.title) ??
    sanitizeOptionText((option as { optionName?: unknown }).optionName) ??
    sanitizeOptionText((option as { name?: unknown }).name) ??
    sanitizeOptionText((option as { text?: unknown }).text) ??
    sanitizeOptionText((option as { description?: unknown }).description) ??
    sanitizeOptionText(option.id)
  );
};

export const buildSelectedOptionSummaries = (
  selectedOptions: PollChoiceSelectedOptionPayload[]
): Array<{ id: string; title: string }> => {
  const normalized: Array<{ id: string; title: string }> = [];
  const seen = new Set<string>();

  for (const option of selectedOptions) {
    const id = sanitizeOptionText(option.id) ?? option.id;
    const title = extractPollOptionLabel(option);
    if (!title) {
      continue;
    }

    const dedupeKey = `${id}|${title}`;
    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    normalized.push({ id, title });
  }

  return normalized;
};

export const buildPollVoteMessageContent = (
  selectedOptions: PollChoiceSelectedOptionPayload[]
): string | null => {
  const summaries = buildSelectedOptionSummaries(selectedOptions);
  if (summaries.length === 0) {
    return null;
  }

  const uniqueTitles: string[] = [];
  const seenTitles = new Set<string>();

  for (const { title } of summaries) {
    const normalized = sanitizeOptionText(title);
    if (!normalized) {
      continue;
    }

    if (seenTitles.has(normalized)) {
      continue;
    }

    seenTitles.add(normalized);
    uniqueTitles.push(normalized);
  }

  if (uniqueTitles.length === 0) {
    return null;
  }

  if (uniqueTitles.length === 1) {
    return uniqueTitles.at(0) ?? null;
  }

  return uniqueTitles.join(', ');
};

export const shouldUpdatePollMessageContent = (content: unknown): boolean => {
  if (typeof content !== 'string') {
    return true;
  }

  const trimmed = content.trim();
  if (!trimmed) {
    return true;
  }

  return POLL_PLACEHOLDER_MESSAGES.has(trimmed);
};

export const normalizeTimestamp = (value: string | null | undefined): string | null => {
  const trimmed = sanitizeOptionText(value);
  if (!trimmed) {
    return null;
  }

  const parsed = Date.parse(trimmed);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString();
  }

  return trimmed;
};

export const asJsonRecord = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }

  return {};
};

export const normalizeChatId = (value: unknown): string | null => {
  const text = sanitizeOptionText(
    typeof value === 'number' && Number.isFinite(value) ? value.toString() : value
  );
  if (!text) {
    return null;
  }

  if (text.includes('@')) {
    return text;
  }

  const digits = text.replace(/[^0-9]/g, '');
  if (!digits) {
    return text;
  }

  return `${digits}@s.whatsapp.net`;
};

export { POLL_PLACEHOLDER_MESSAGES };
