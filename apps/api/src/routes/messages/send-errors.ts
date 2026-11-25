import type { Request, Response } from 'express';

import { logger } from '../../config/logger';
import {
  WhatsAppBrokerError,
  WhatsAppBrokerNotConfiguredError,
  translateWhatsAppBrokerError,
} from '../../services/whatsapp-broker-client';

/**
 * Fronteira de envio (POST /api/tickets/:ticketId/messages e /api/contacts/:contactId/messages).
 *
 * O broker devolve códigos crus (`REQUEST_TIMEOUT`, `SESSION_NOT_CONNECTED`, `RATE_LIMIT_EXCEEDED`, …) e o web
 * decide cópia, nova tentativa e o botão "Reconectar" pelos códigos normalizados
 * (apps/web/src/features/whatsapp/utils/whatsapp-error-codes.js). Normalizamos só aqui — o errorHandler global
 * segue genérico — e o código cru vai em `details.brokerCode` para diagnóstico.
 */
export type NormalizedSendErrorCode =
  | 'BROKER_TIMEOUT'
  | 'INSTANCE_NOT_CONNECTED'
  | 'RATE_LIMITED'
  | 'INVALID_TO'
  | 'BROKER_NOT_CONFIGURED'
  | 'UNSUPPORTED_OPERATION'
  | 'BROKER_ERROR';

export type NormalizedSendError = {
  status: number;
  code: NormalizedSendErrorCode;
  message: string;
  brokerCode: string | null;
  brokerStatus: number | null;
  requestId: string | null;
};

// Mensagens da API (o web usa a própria cópia por código). Mesmo texto de CANONICAL_ERRORS (@ticketz/wa-contracts).
const MESSAGES: Record<NormalizedSendErrorCode, string> = {
  BROKER_TIMEOUT: 'Tempo limite ao contatar o transporte do WhatsApp. Tente reenviar em instantes.',
  INSTANCE_NOT_CONNECTED: 'Instância de WhatsApp desconectada. Reabra a sessão para continuar.',
  RATE_LIMITED: 'Limite de envio do WhatsApp atingido. Aguarde alguns instantes e tente novamente.',
  INVALID_TO: 'Número de destino inválido ou indisponível para receber mensagens.',
  BROKER_NOT_CONFIGURED: 'WhatsApp não configurado. Conecte um número para enviar mensagens.',
  UNSUPPORTED_OPERATION: 'Operação não suportada pelo transporte WhatsApp ativo.',
  BROKER_ERROR: 'Não foi possível enviar a mensagem pelo WhatsApp.',
};

const FALLBACK_STATUS: Record<NormalizedSendErrorCode, number> = {
  BROKER_TIMEOUT: 504,
  INSTANCE_NOT_CONNECTED: 409,
  RATE_LIMITED: 429,
  INVALID_TO: 422,
  BROKER_NOT_CONFIGURED: 503,
  UNSUPPORTED_OPERATION: 400,
  BROKER_ERROR: 502,
};

const readString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

type TransportErrorLike = {
  code?: unknown;
  status?: unknown;
  requestId?: unknown;
  message: string;
  canonical?: { code?: string } | null;
};

// WhatsAppTransportError (@ticketz/wa-contracts) é reconhecido pelo `name`, como no errorHandler global: evita
// depender da identidade da classe entre bundles/duplicatas do pacote.
const asTransportError = (error: unknown): TransportErrorLike | null =>
  error instanceof Error && error.name === 'WhatsAppTransportError' ? (error as unknown as TransportErrorLike) : null;

const readStatus = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) ? value : null;

/**
 * Status HTTP repassado ao cliente: o do broker quando é um erro "do envio"; 401/403 do broker são credencial do
 * servidor (API key), não sessão do operador — repassá-los faria o web deslogar. Sem status, usa o do código.
 */
const resolveHttpStatus = (code: NormalizedSendErrorCode, brokerStatus: number | null): number => {
  if (code === 'BROKER_NOT_CONFIGURED') {
    return 503;
  }
  if (brokerStatus !== null && brokerStatus >= 400 && brokerStatus <= 599 && brokerStatus !== 401 && brokerStatus !== 403) {
    return brokerStatus;
  }
  return FALLBACK_STATUS[code];
};

const toNormalizedCode = (canonicalCode: string | null | undefined): NormalizedSendErrorCode => {
  switch (canonicalCode) {
    case 'BROKER_TIMEOUT':
    case 'INSTANCE_NOT_CONNECTED':
    case 'RATE_LIMITED':
    case 'INVALID_TO':
    case 'UNSUPPORTED_OPERATION':
      return canonicalCode;
    case 'TRANSPORT_NOT_CONFIGURED':
      return 'BROKER_NOT_CONFIGURED';
    default:
      return 'BROKER_ERROR';
  }
};

/** Traduz erros do broker/transporte para o contrato do web; `null` para qualquer outro erro. */
export const normalizeSendError = (error: unknown): NormalizedSendError | null => {
  if (error instanceof WhatsAppBrokerNotConfiguredError) {
    return {
      status: 503,
      code: 'BROKER_NOT_CONFIGURED',
      message: MESSAGES.BROKER_NOT_CONFIGURED,
      brokerCode: null,
      brokerStatus: null,
      requestId: null,
    };
  }

  if (error instanceof WhatsAppBrokerError) {
    const brokerCode = readString(error.brokerCode) ?? readString(error.code);
    const brokerStatus = readStatus(error.brokerStatus);
    const code = toNormalizedCode(translateWhatsAppBrokerError(error)?.code);
    return {
      status: resolveHttpStatus(code, brokerStatus),
      code,
      message: MESSAGES[code],
      brokerCode,
      brokerStatus,
      requestId: readString(error.requestId),
    };
  }

  const transportError = asTransportError(error);
  if (transportError) {
    const brokerCode = readString(transportError.code);
    const brokerStatus = readStatus(transportError.status);
    // `canonical` só existe quando o transporte já devolveu um código canônico; códigos crus passam pela mesma
    // tradução usada para os erros do broker.
    const canonicalCode =
      transportError.canonical?.code ??
      translateWhatsAppBrokerError({
        code: brokerCode ?? '',
        brokerStatus: brokerStatus ?? undefined,
        message: transportError.message,
      } as WhatsAppBrokerError)?.code;
    const code = toNormalizedCode(canonicalCode);
    return {
      status: resolveHttpStatus(code, brokerStatus),
      code,
      message: MESSAGES[code],
      brokerCode,
      brokerStatus,
      requestId: readString(transportError.requestId),
    };
  }

  return null;
};

/** Responde a falha de envio normalizada; devolve `false` quando o erro não é do broker (o caller relança). */
export const respondWithSendFailure = (
  req: Request,
  res: Response,
  error: unknown,
  context: Record<string, unknown> = {}
): boolean => {
  const normalized = normalizeSendError(error);
  if (!normalized) {
    return false;
  }

  res.locals.errorCode = normalized.code;
  logger.warn('whatsapp.outbound.send.failed', {
    ...context,
    requestId: req.rid ?? null,
    code: normalized.code,
    status: normalized.status,
    brokerCode: normalized.brokerCode,
    brokerStatus: normalized.brokerStatus,
    brokerRequestId: normalized.requestId,
  });

  res.status(normalized.status).json({
    success: false,
    error: {
      code: normalized.code,
      message: normalized.message,
      // Mesmo id do errorHandler global (X-Request-Id); o id do broker fica em details.
      requestId: req.rid ?? normalized.requestId,
      details: {
        brokerCode: normalized.brokerCode,
        brokerStatus: normalized.brokerStatus,
        requestId: normalized.requestId,
      },
    },
  });
  return true;
};
