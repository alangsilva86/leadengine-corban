const isPlainObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

const getNestedValue = (object, path) => {
  if (!isPlainObject(object) || !Array.isArray(path)) {
    return undefined;
  }

  return path.reduce((acc, key) => {
    if (acc && typeof acc === 'object' && key in acc) {
      return acc[key];
    }
    return undefined;
  }, object);
};

const isValidDate = (date) => date instanceof Date && !Number.isNaN(date.getTime());

export const ensureDate = (value) => {
  if (!value) return null;

  if (isValidDate(value)) {
    return value;
  }

  const parsed = new Date(value);
  return isValidDate(parsed) ? parsed : null;
};

const defaultFormatOptions = {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
};

export const formatDateTime = (value, options) => {
  const date = ensureDate(value);
  if (!date) return null;

  const formatOptions = options ? { ...defaultFormatOptions, ...options } : defaultFormatOptions;
  return date.toLocaleString('pt-BR', formatOptions);
};

export const getFirstValidDate = (object, paths) => {
  if (!Array.isArray(paths)) {
    return null;
  }

  for (const path of paths) {
    const candidate = getNestedValue(object, path);
    const date = ensureDate(candidate);
    if (date) {
      return { value: candidate, date, path };
    }
  }

  return null;
};

export const getFirstString = (object, paths) => {
  if (!Array.isArray(paths)) {
    return null;
  }

  for (const path of paths) {
    const candidate = getNestedValue(object, path);
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return null;
};

export default {
  ensureDate,
  formatDateTime,
  getFirstValidDate,
  getFirstString,
};
