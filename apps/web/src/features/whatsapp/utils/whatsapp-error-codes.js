const NORMALIZED_WHATSAPP_ERRORS = {
  INSTANCE_NOT_CONNECTED: {
    code: 'INSTANCE_NOT_CONNECTED',
    title: 'Instância desconectada',
    description: 'Conecte novamente a instância do WhatsApp para retomar os envios.',
  },
  INVALID_TO: {
    code: 'INVALID_TO',
    title: 'Número de destino inválido',
    description: 'Revise o número informado e confirme se o contato possui WhatsApp ativo.',
  },
  RATE_LIMITED: {
    code: 'RATE_LIMITED',
    title: 'Limite de envio atingido',
    description: 'Aguarde alguns instantes para reenviar. O broker sinalizou limite de envios.',
  },
  BROKER_TIMEOUT: {
    code: 'BROKER_TIMEOUT',
    title: 'Tempo limite excedido',
    description: 'O broker não respondeu a tempo. Tente novamente em alguns segundos.',
  },
};

export const normalizeWhatsAppErrorCode = (code) => {
  if (typeof code !== 'string') {
    return null;
  }
  const normalized = code.trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
};

export const resolveWhatsAppErrorCopy = (code, fallbackMessage) => {
  const normalized = normalizeWhatsAppErrorCode(code);
  if (!normalized) {
    return {
      code: null,
      title: null,
      description: fallbackMessage ?? null,
    };
  }

  const copy = NORMALIZED_WHATSAPP_ERRORS[normalized];
  if (!copy) {
    return {
      code: normalized,
      title: null,
      description: fallbackMessage ?? null,
    };
  }

  return {
    code: copy.code,
    title: copy.title,
    description: copy.description,
  };
};

export const isNormalizedWhatsAppError = (code) => {
  const normalized = normalizeWhatsAppErrorCode(code);
  return Boolean(normalized && NORMALIZED_WHATSAPP_ERRORS[normalized]);
};

export const getAllWhatsAppErrorCodes = () => Object.keys(NORMALIZED_WHATSAPP_ERRORS);

export default NORMALIZED_WHATSAPP_ERRORS;
