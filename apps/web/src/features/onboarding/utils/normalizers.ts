export const normalizeSlugInput = (value: string): string => {
  if (!value) {
    return '';
  }

  const lower = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  return lower
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
};

export const normalizePersonName = (value: string): string => {
  if (!value) {
    return '';
  }

  return value
    .replace(/\s+/g, ' ')
    .trim();
};
