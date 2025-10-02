const removeDiacritics = (value: string): string =>
  value.normalize('NFKD').replace(/[^\w\s-]/g, '').replace(/[\u0300-\u036f]/g, '');

export const toSlug = (value: string, fallback = ''): string => {
  if (!value) {
    return fallback;
  }
  const noAccents = removeDiacritics(value);
  const slug = noAccents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  return slug || fallback;
};

export const isValidSlug = (value: string): boolean => {
  return /^[a-z0-9\-]+$/.test(value);
};

export const assertValidSlug = (value: string, field = 'slug'): void => {
  if (!isValidSlug(value)) {
    throw new Error(`${field} deve conter apenas letras minúsculas, números ou hífens.`);
  }
};
