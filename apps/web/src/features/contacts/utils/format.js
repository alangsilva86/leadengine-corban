import { formatPhoneNumber } from '@/lib/utils.js';

const onlyDigits = (value) => String(value ?? '').replace(/\D/g, '');

/**
 * Telefone para exibição: "+55 (62) 99977-6655" (celular) ou "+55 (62) 3333-4444" (fixo).
 * Retorna null quando não há telefone, para a interface decidir o texto.
 */
export const formatPhone = (value) => {
  const digits = onlyDigits(value);
  if (!digits) return null;
  if (digits.length === 12 && digits.startsWith('55')) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }
  return formatPhoneNumber(value);
};

/** Máscara progressiva para digitação de telefone brasileiro: "(62) 99977-6655". */
export const maskPhoneInput = (value) => {
  let digits = onlyDigits(value);
  if (digits.length > 11 && digits.startsWith('55')) {
    digits = digits.slice(2);
  }
  digits = digits.slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  const area = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (rest.length <= 4) return `(${area}) ${rest}`;
  if (rest.length <= 8) return `(${area}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  return `(${area}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
};

/** Converte a digitação para E.164 (+55DDDNÚMERO). Retorna null se não for um telefone válido. */
export const toE164 = (value) => {
  const raw = String(value ?? '').trim();
  let digits = onlyDigits(raw);
  if (!digits) return null;
  if (raw.startsWith('+') && !digits.startsWith('55')) {
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }
  if (digits.length > 11 && digits.startsWith('55')) {
    digits = digits.slice(2);
  }
  if (digits.length !== 10 && digits.length !== 11) return null;
  if (digits.length === 11 && digits[2] !== '9') return null;
  return `+55${digits}`;
};

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
