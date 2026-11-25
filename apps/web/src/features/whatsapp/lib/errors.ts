import { getFriendlyErrorMessage, getStatusMessage } from '@/lib/errors.js';

export interface WhatsAppErrorCopy {
  code: string | null;
  title: string;
  message: string;
}

/**
 * Textos para os erros conhecidos da integração com o WhatsApp.
 * O usuário nunca vê o código, o nome do conector ou mensagens técnicas em inglês.
 */
const KNOWN_ERRORS: Record<string, { title: string; message: string }> = {
  WHATSAPP_NOT_CONFIGURED: {
    title: 'WhatsApp ainda não está disponível',
    message: 'A integração com o WhatsApp não foi ativada para sua empresa. Fale com o suporte para liberar.',
  },
  BROKER_NOT_CONFIGURED: {
    title: 'WhatsApp ainda não está disponível',
    message: 'A integração com o WhatsApp não foi ativada para sua empresa. Fale com o suporte para liberar.',
  },
  WHATSAPP_STORAGE_UNAVAILABLE: {
    title: 'Não foi possível carregar seus números',
    message: 'O serviço está instável no momento. Tente de novo em alguns minutos.',
  },
  INSTANCE_NOT_FOUND: {
    title: 'Número não encontrado',
    message: 'Este número foi removido ou não existe mais. Atualize a lista.',
  },
  INSTANCE_ALREADY_EXISTS: {
    title: 'Nome já em uso',
    message: 'Já existe um número com esse nome. Escolha outro nome e tente de novo.',
  },
  INVALID_INSTANCE_PAYLOAD: {
    title: 'Dados inválidos',
    message: 'Revise o nome do número e tente de novo.',
  },
  RATE_LIMITED: {
    title: 'Muitas tentativas seguidas',
    message: 'Aguarde alguns segundos e tente de novo.',
  },
  BROKER_TIMEOUT: {
    title: 'O WhatsApp demorou para responder',
    message: 'Tente de novo em alguns segundos.',
  },
  BROKER_ERROR: {
    title: 'O WhatsApp não respondeu',
    message: 'O serviço do WhatsApp está instável no momento. Tente de novo em alguns minutos.',
  },
  INSTANCE_NOT_CONNECTED: {
    title: 'Número desconectado',
    message: 'Reconecte o número para voltar a enviar e receber mensagens.',
  },
};

// Mensagens que vazam detalhes da infraestrutura e não devem ir para a tela.
const TECHNICAL_MESSAGE = /broker|baileys|jid|tenant|payload|webhook|instance|prisma|econn|enotfound|status code|\bapi\b/i;

const readErrorCode = (error: any): string | null => {
  const candidates = [
    error?.payload?.error?.code,
    error?.response?.data?.error?.code,
    error?.code,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim() && !/^\d+$/.test(candidate.trim())) {
      return candidate.trim().toUpperCase();
    }
  }
  return null;
};

const readStatus = (error: any): number | null => {
  const candidates = [error?.status, error?.statusCode, error?.response?.status];
  for (const candidate of candidates) {
    if (typeof candidate === 'number') return candidate;
  }
  if (typeof error?.code === 'string' && /^\d{3}$/.test(error.code)) {
    return Number(error.code);
  }
  return null;
};

/**
 * Converte qualquer erro da integração em título + frase em português.
 * @param fallbackTitle título quando o erro não é conhecido ("Não foi possível conectar o número").
 */
export const resolveWhatsAppError = (
  error: unknown,
  fallbackTitle = 'Algo deu errado',
): WhatsAppErrorCopy => {
  const code = readErrorCode(error);
  if (code && KNOWN_ERRORS[code]) {
    return { code, ...KNOWN_ERRORS[code] };
  }

  const rawMessage =
    (error as any)?.payload?.error?.message ??
    (typeof (error as any)?.message === 'string' ? (error as any).message : null);

  if (typeof rawMessage === 'string' && TECHNICAL_MESSAGE.test(rawMessage)) {
    const status = readStatus(error);
    return {
      code,
      title: fallbackTitle,
      message: getStatusMessage(status ?? 500) ?? 'Algo deu errado. Tente de novo.',
    };
  }

  return {
    code,
    title: fallbackTitle,
    message: getFriendlyErrorMessage(error),
  };
};

export default resolveWhatsAppError;
