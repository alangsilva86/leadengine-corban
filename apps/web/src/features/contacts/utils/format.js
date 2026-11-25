const onlyDigits = (value) => String(value ?? '').replace(/\D/g, '');

/**
 * Documento com máscara LGPD. CPF: "***.456.789-**". CNPJ: "**.345.678/0001-**".
 * Com `reveal`, devolve o documento formatado por completo.
 */
export const formatDocument = (value, { reveal = false } = {}) => {
  const digits = onlyDigits(value);
  if (!digits) return null;
  if (digits.length === 11) {
    const formatted = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
    return reveal ? formatted : `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
  }
  if (digits.length === 14) {
    const formatted = `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
    return reveal ? formatted : `**.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-**`;
  }
  return reveal ? String(value) : `•••••${digits.slice(-2)}`;
};

export const documentKindLabel = (value) => {
  const digits = onlyDigits(value);
  if (digits.length === 14) return 'CNPJ';
  if (digits.length === 11) return 'CPF';
  return 'Documento';
};

/** "cidade" → "Cidade", "data_nascimento" → "Data nascimento". */
export const humanizeFieldKey = (key) => {
  const text = String(key ?? '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
};

export const CONTACT_STATUS_LABELS = {
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
  ARCHIVED: 'Arquivado',
};
