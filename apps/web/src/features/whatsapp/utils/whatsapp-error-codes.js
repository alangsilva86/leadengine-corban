const NORMALIZED_WHATSAPP_ERRORS = {
  INSTANCE_NOT_CONNECTED: {
    code: 'INSTANCE_NOT_CONNECTED',
    title: 'Número desconectado',
    description: 'Reconecte o número de WhatsApp para voltar a enviar mensagens.',
  },
  INVALID_TO: {
    code: 'INVALID_TO',
    title: 'Número de destino inválido',
    description: 'Revise o número informado e confirme se o contato possui WhatsApp ativo.',
  },
  RATE_LIMITED: {
    code: 'RATE_LIMITED',
    title: 'Limite de envio atingido',
    description: 'O WhatsApp limitou os envios deste número. Aguarde alguns minutos antes de tentar de novo.',
  },
  BROKER_TIMEOUT: {
    code: 'BROKER_TIMEOUT',
    title: 'Tempo limite excedido',
    description: 'O WhatsApp demorou a responder. Tente de novo em alguns segundos.',
  },
  BROKER_NOT_CONFIGURED: {
    code: 'BROKER_NOT_CONFIGURED',
    title: 'WhatsApp não configurado',
    description: 'Conecte um número de WhatsApp para enviar mensagens.',
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
