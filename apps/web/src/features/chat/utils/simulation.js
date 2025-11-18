export const NO_STAGE_VALUE = '__none__';

export const formatJson = (value) => {
  if (!value || typeof value !== 'object') {
    return '';
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '';
  }
};

export const normalizeStageState = (value) => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  return NO_STAGE_VALUE;
};

export const resolveStageValue = (value) => {
  if (typeof value === 'string' && value !== NO_STAGE_VALUE && value.trim().length > 0) {
    return value.trim();
  }
  return '';
};

export const formatDateInput = (date) => {
  const safe = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const year = safe.getFullYear();
  const month = String(safe.getMonth() + 1).padStart(2, '0');
  const day = String(safe.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseDateInput = (value) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }
  const [year, month, day] = value.split('-').map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const ensureUniqueTerms = (terms) =>
  Array.from(new Set((Array.isArray(terms) ? terms : []).filter((term) => Number.isFinite(term)))).sort(
    (a, b) => a - b,
  );

const METADATA_ERROR_MESSAGE = 'Metadata deve ser um JSON válido.';

export const parseMetadataText = (metadataText) => {
  if (typeof metadataText !== 'string') {
    return { parsed: null, error: METADATA_ERROR_MESSAGE };
  }

  const trimmed = metadataText.trim();
  if (trimmed.length === 0) {
    return { parsed: null, error: null };
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== 'object') {
      return { parsed: null, error: METADATA_ERROR_MESSAGE };
    }
    return { parsed, error: null };
  } catch {
    return { parsed: null, error: METADATA_ERROR_MESSAGE };
  }
};

