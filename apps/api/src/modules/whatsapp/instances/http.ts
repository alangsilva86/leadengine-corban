import process from 'node:process';
import { param } from 'express-validator';
import { WhatsAppBrokerError, WhatsAppBrokerNotConfiguredError } from '../../../services/whatsapp-broker-client';
import { compactRecord } from './helpers';
import { logWhatsAppStorageError, resolveWhatsAppStorageError, trackStorageUnavailable } from './errors';

export const INVALID_INSTANCE_ID_MESSAGE = 'Identificador de instância inválido.';

export const resolveDefaultInstanceId = (): string =>
  (process.env.LEADENGINE_INSTANCE_ID || '').trim() || 'leadengine';

export const looksLikeWhatsAppJid = (value: string): boolean =>
  typeof value === 'string' && value.toLowerCase().endsWith('@s.whatsapp.net');

export const normalizeBooleanValue = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return null;
    }
    if (['1', 'true', 'yes', 'y', 'sim'].includes(normalized)) {
      return true;
    }
    if (['0', 'false', 'no', 'n', 'nao', 'não'].includes(normalized)) {
      return false;
    }
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value === 1) {
      return true;
    }
    if (value === 0) {
      return false;
    }
  }

  return null;
};

export type RequestLike = { params?: Record<string, unknown> | undefined };

export const readInstanceIdParam = (req: RequestLike): string | null => {
  const raw = req?.params?.id;
  if (typeof raw !== 'string') {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export type ResponseLike = {
  locals?: Record<string, unknown>;
  status(code: number): ResponseLike;
  json(payload: unknown): ResponseLike;
};

export const readBrokerErrorStatus = (error: unknown): number | null => {
  if (!error || typeof error !== 'object') {
    return null;
  }

  if ('brokerStatus' in error && typeof (error as { brokerStatus?: unknown }).brokerStatus === 'number') {
    return (error as { brokerStatus: number }).brokerStatus;
  }

  if ('status' in error && typeof (error as { status?: unknown }).status === 'number') {
    return (error as { status: number }).status;
  }

  return null;
};

export const respondWhatsAppNotConfigured = (res: ResponseLike, error: unknown): boolean => {
  if (error instanceof WhatsAppBrokerNotConfiguredError) {
    if (!res.locals) {
      res.locals = {};
    }
    res.locals.errorCode = 'WHATSAPP_NOT_CONFIGURED';

    const details = compactRecord({
      missing:
        Array.isArray(error.missing) && error.missing.length > 0 ? [...new Set(error.missing)] : undefined,
    });

    res.status(503).json({
      success: false,
      error: {
        code: 'WHATSAPP_NOT_CONFIGURED',
        message: error.message,
        ...(details ? { details } : {}),
      },
    });
    return true;
  }

  return false;
};

export const respondWhatsAppStorageUnavailable = (
  res: ResponseLike,
  error: unknown,
  context: { tenantId?: string; instanceId?: string | null; operation?: string | null; operationType?: string | null } = {}
): boolean => {
  const { isStorageError, prismaCode } = resolveWhatsAppStorageError(error);

  if (!isStorageError) {
    return false;
  }

  const storageDisabled = prismaCode === 'DATABASE_DISABLED';
  const operation = context.operation ?? 'storage';

  logWhatsAppStorageError(operation, error, {
    ...context,
    prismaCode,
  });

  trackStorageUnavailable(operation, {
    tenantId: context.tenantId,
    instanceId: context.instanceId,
    operationType: context.operationType,
    errorCode: storageDisabled ? 'DATABASE_DISABLED' : 'WHATSAPP_STORAGE_UNAVAILABLE',
  });

  if (storageDisabled) {
    if (!res.locals) {
      res.locals = {};
    }
    res.locals.errorCode = 'DATABASE_DISABLED';
    res.status(503).json({
      success: false,
      error: {
        code: 'DATABASE_DISABLED',
        message: 'Persistência das instâncias WhatsApp está desabilitada neste ambiente.',
      },
    });
    return true;
  }

  if (!res.locals) {
    res.locals = {};
  }
  res.locals.errorCode = 'WHATSAPP_STORAGE_UNAVAILABLE';
  res.status(503).json({
    success: false,
    error: {
      code: 'WHATSAPP_STORAGE_UNAVAILABLE',
      message:
        'Serviço de armazenamento das instâncias WhatsApp indisponível. Verifique a conexão com o banco ou execute as migrações pendentes.',
      ...(prismaCode ? { details: { prismaCode } } : {}),
    },
  });
  return true;
};

export const handleWhatsAppIntegrationError = (res: ResponseLike, error: unknown): boolean => {
  if (respondWhatsAppNotConfigured(res, error)) {
    return true;
  }

  if (respondWhatsAppStorageUnavailable(res, error)) {
    return true;
  }

  return false;
};

export const instanceIdParamValidator = () =>
  param('id')
    .custom((value, { req }) => {
      if (typeof value !== 'string') {
        throw new Error(INVALID_INSTANCE_ID_MESSAGE);
      }

      try {
        const decoded = decodeURIComponent(value);
        const request = req as RequestLike & { params?: Record<string, string> };
        if (!request.params) {
          request.params = {};
        }
        request.params.id = decoded;
        return true;
      } catch {
        throw new Error(INVALID_INSTANCE_ID_MESSAGE);
      }
    })
    .withMessage(INVALID_INSTANCE_ID_MESSAGE)
    .bail()
    .trim()
    .isLength({ min: 1 })
    .withMessage(INVALID_INSTANCE_ID_MESSAGE);

export const respondWhatsAppBrokerFailure = (res: ResponseLike, error: WhatsAppBrokerError): void => {
  const status = readBrokerErrorStatus(error) ?? error.status ?? 502;
  const responseTimeMs = (error as WhatsAppBrokerError & { responseTimeMs?: number }).responseTimeMs;

  res.status(status).json({
    success: false,
    error: {
      code: error.code || 'BROKER_ERROR',
      message: error.message || 'WhatsApp broker request failed',
      details: compactRecord({
        status,
        requestId: error.requestId ?? undefined,
        brokerCode: error.brokerCode ?? undefined,
        responseTimeMs,
      }),
    },
  });
};

export const respondLegacyEndpointGone = (res: ResponseLike, message: string): void => {
  res.status(410).json({
    success: false,
    error: {
      code: 'ENDPOINT_GONE',
      message,
    },
  });
};
