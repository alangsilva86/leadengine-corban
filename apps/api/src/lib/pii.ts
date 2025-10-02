export const maskPhone = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const digits = value.replace(/\D/g, '');
  if (digits.length < 4) {
    return '*'.repeat(digits.length);
  }

  const visible = digits.slice(-4);
  return `***${visible}`;
};

export const maskDocument = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const digits = value.replace(/\D/g, '');
  if (digits.length <= 4) {
    return '*'.repeat(digits.length);
  }

  const visible = digits.slice(-4);
  return `${'*'.repeat(Math.max(0, digits.length - 4))}${visible}`;
};

export const maskString = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  if (value.length <= 4) {
    return '*'.repeat(value.length);
  }

  return `${value.slice(0, 2)}***${value.slice(-2)}`;
};
