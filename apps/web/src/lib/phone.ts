/**
 * Telefones: exibição, máscara de digitação e normalização (fonte única do web).
 * Normalização de payload para a API continua em `@ticketz/shared` (`normalizePhoneE164`).
 */

const onlyDigits = (value: unknown) => String(value ?? '').replace(/\D/g, '');

/**
 * "+55 (11) 98765-4321", "(11) 98765-4321" ou "(11) 3265-4321".
 * Sem valor devolve "—"; valores que não parecem telefone voltam como vieram.
 */
export const formatPhoneNumber = (value: unknown): string => {
  if (!value) return '—';
  const digits = String(value).replace(/\D/g, '');

  if (!digits) {
    return value as string;
  }

  if (digits.length === 13 && digits.startsWith('55')) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }

  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  if (digits.length > 4) {
    return `+${digits.slice(0, 2)} ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return value as string;
};

/**
 * Telefone de contato para exibição: "+55 (62) 99977-6655" (celular) ou "+55 (62) 3333-4444" (fixo).
 * Retorna null quando não há telefone, para a interface decidir o texto.
 */
export const formatPhone = (value: unknown): string | null => {
  const digits = onlyDigits(value);
  if (!digits) return null;
  if (digits.length === 12 && digits.startsWith('55')) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }
  return formatPhoneNumber(value);
};

/** Máscara progressiva para digitação de telefone brasileiro: "(62) 99977-6655". */
export const maskPhoneInput = (value: unknown): string => {
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
export const toE164 = (value: unknown): string | null => {
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

const JID_SUFFIX_PATTERN = /@(s\.whatsapp\.net|c\.us|lid|g\.us)$/i;

/**
 * Dígitos de um número de WhatsApp: remove o sufixo técnico ("@s.whatsapp.net") e o
 * identificador de aparelho (":12"). `null` quando não há número utilizável (8–15 dígitos).
 */
export const extractWhatsAppDigits = (value: unknown): string | null => {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }
  const raw = `${value}`.trim().replace(JID_SUFFIX_PATTERN, '');
  const withoutDevice = raw.includes(':') ? raw.slice(0, raw.indexOf(':')) : raw;
  const digits = withoutDevice.replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
};

/**
 * Número de WhatsApp para exibição: "+55 11 91234-5678".
 * Nunca devolve o identificador técnico (JID); retorna `null` quando não há número.
 */
export const formatWhatsAppNumber = (value: unknown): string | null => {
  const digits = extractWhatsAppDigits(value);
  if (!digits) {
    return null;
  }

  const national = digits.startsWith('55') && (digits.length === 12 || digits.length === 13) ? digits.slice(2) : null;
  const brazilian = national ?? (digits.length === 10 || digits.length === 11 ? digits : null);

  if (brazilian) {
    const ddd = brazilian.slice(0, 2);
    const rest = brazilian.slice(2);
    const splitAt = rest.length - 4;
    return `+55 ${ddd} ${rest.slice(0, splitAt)}-${rest.slice(splitAt)}`;
  }

  return `+${digits}`;
};
