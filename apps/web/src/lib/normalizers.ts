export const normalizePersonName = (value: string): string => {
  if (!value) {
    return '';
  }

  return value.replace(/\s+/g, ' ').trim();
};

