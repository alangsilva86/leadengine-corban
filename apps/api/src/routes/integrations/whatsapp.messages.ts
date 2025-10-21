import express, { Router, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';

import { asyncHandler } from '../../middleware/error-handler';
import { prisma } from '../../lib/prisma';
import { rateKeyForInstance, resolveInstanceRateLimit, sendAdHoc } from '../../services/ticket-service';
import {
  WhatsAppBrokerError,
  translateWhatsAppBrokerError,
} from '../../services/whatsapp-broker-client';
import { getWhatsAppTransport } from '../../features/whatsapp-transport';
import { WhatsAppTransportError } from '@ticketz/wa-contracts';
import { NotFoundError } from '@ticketz/core';
import { whatsappHttpRequestsCounter } from '../../lib/metrics';
import { logger } from '../../config/logger';
import { respondWithValidationError } from '../../utils/http-validation';
import { assertWithinRateLimit, RateLimitError } from '../../utils/rate-limit';

const instrumentationMiddleware: express.RequestHandler = (req, res, next) => {
  const startedAt = Date.now();
  const providedRequestId = (req.header('x-request-id') || '').trim();
  const requestId = providedRequestId.length > 0 ? providedRequestId : randomUUID();
  const contentType = req.headers['content-type'] ?? null;
  const bodyKeys =
    req.body && typeof req.body === 'object' && !Array.isArray(req.body)
      ? Object.keys(req.body)
      : [];
  const tenantId = req.user?.tenantId ?? null;

  if (!res.getHeader('x-request-id')) {
    res.setHeader('x-request-id', requestId);
  }

  res.locals.requestId = requestId;

  logger.info('📨 [WhatsApp API] Request received', {
    route: `${req.baseUrl}${req.path}`,
    method: req.method,
    tenantId,
    requestId,
    contentType,
    bodyKeys,
  });

  res.once('finish', () => {
    const elapsedMs = Date.now() - startedAt;
    const status = res.statusCode;
    const errorCode = (res.locals?.errorCode ?? null) as string | null;
    const result = status >= 500 ? 'error' : status >= 400 ? 'client_error' : 'success';

    whatsappHttpRequestsCounter.inc({
      route: req.route?.path ?? req.path,
      method: req.method,
      status,
      code: errorCode ?? 'OK',
      result,
    });

    logger.info('📬 [WhatsApp API] Request completed', {
      route: `${req.baseUrl}${req.path}`,
      method: req.method,
      tenantId,
      requestId,
      status,
      durationMs: elapsedMs,
      result,
      errorCode: errorCode ?? undefined,
    });
  });

  next();
};

let contractsPromise: Promise<typeof import('@ticketz/contracts')> | null = null;
const loadContracts = async () => {
  if (!contractsPromise) {
    contractsPromise = import('@ticketz/contracts');
  }
  return contractsPromise;
};

const router: Router = Router();

router.use(express.json({ limit: '1mb' }));
router.use(instrumentationMiddleware);

router.post(
  '/integrations/whatsapp/instances/:instanceId/messages',
  asyncHandler(async (req: Request, res: Response) => {
    const instanceIdParam = req.params.instanceId;
    const instanceId = typeof instanceIdParam === 'string' ? instanceIdParam.trim() : '';
    if (!instanceId) {
      throw new NotFoundError('WhatsAppInstance', instanceIdParam ?? '');
    }

    const instance = await prisma.whatsAppInstance.findUnique({ where: { id: instanceId } });

    if (!instance) {
      throw new NotFoundError('WhatsAppInstance', instanceId);
    }

    const headerTenantRaw = req.headers['x-tenant-id'];
    const headerTenantId = Array.isArray(headerTenantRaw)
      ? headerTenantRaw.map((value) => value?.trim()).find((value) => value)
      : typeof headerTenantRaw === 'string'
        ? headerTenantRaw.trim() || undefined
        : undefined;
    const userTenantId = typeof req.user?.tenantId === 'string' ? req.user.tenantId.trim() || undefined : undefined;

    if (headerTenantId && userTenantId && headerTenantId !== userTenantId) {
      res.locals.errorCode = 'TENANT_HEADER_MISMATCH';
      res.status(403).json({
        success: false,
        error: {
          code: 'TENANT_HEADER_MISMATCH',
          message: 'Tenant informado não corresponde ao usuário autenticado.',
        },
      });
      return;
    }

    const resolvedTenantId = userTenantId ?? headerTenantId ?? null;

    if (resolvedTenantId && resolvedTenantId !== instance.tenantId) {
      throw new NotFoundError('WhatsAppInstance', instanceId);
    }

    const isConnected =
      instance.connected ?? (typeof instance.status === 'string' && instance.status === 'connected');

    if (!isConnected) {
      res.locals.errorCode = 'INSTANCE_DISCONNECTED';
      res.status(409).json({
        success: false,
        error: {
          code: 'INSTANCE_DISCONNECTED',
          message: 'A instância de WhatsApp está desconectada.',
          details: {
            status: instance.status ?? null,
            connected: instance.connected ?? null,
          },
        },
      });
      return;
    }

    const { SendByInstanceSchema, normalizePayload } = await loadContracts();

    const parsedResult = SendByInstanceSchema.safeParse(req.body ?? {});
    if (!parsedResult.success) {
      respondWithValidationError(res, parsedResult.error.issues);
      return;
    }

    const parsed = parsedResult.data;

    const headerIdempotency = (req.get('Idempotency-Key') || '').trim();
    if (!headerIdempotency) {
      res.locals.errorCode = 'IDEMPOTENCY_KEY_REQUIRED';
      res.status(409).json({
        success: false,
        error: {
          code: 'IDEMPOTENCY_KEY_REQUIRED',
          message: 'Informe o cabeçalho Idempotency-Key para envios via API.',
        },
      });
      return;
    }

    if (headerIdempotency !== parsed.idempotencyKey) {
      res.locals.errorCode = 'IDEMPOTENCY_KEY_MISMATCH';
      res.status(409).json({
        success: false,
        error: {
          code: 'IDEMPOTENCY_KEY_MISMATCH',
          message: 'O Idempotency-Key do cabeçalho deve coincidir com o corpo da requisição.',
        },
      });
      return;
    }

    const rateLimitKey = rateKeyForInstance(instance.tenantId, instance.id);
    const rateLimit = resolveInstanceRateLimit(instance.id);
    try {
      assertWithinRateLimit(rateLimitKey, rateLimit);
    } catch (error) {
      if (error instanceof RateLimitError) {
        res.locals.errorCode = 'RATE_LIMITED';
      }
      throw error;
    }

    const idempotencyKey = parsed.idempotencyKey;
    const payload = normalizePayload(parsed.payload);

    try {
      const transport = getWhatsAppTransport();
      const sendParams: Parameters<typeof sendAdHoc>[0] = {
        instanceId: instance.id,
        to: parsed.to,
        payload,
        idempotencyKey,
        rateLimitConsumed: true,
      };

      if (req.user?.id) {
        sendParams.operatorId = req.user.id;
      }

      if (resolvedTenantId) {
        sendParams.tenantId = resolvedTenantId;
      }

      const response = await sendAdHoc(sendParams, { transport });

      res.status(202).json(response);
    } catch (error) {
      if (error instanceof WhatsAppTransportError) {
        const canonical = error.canonical;
        const resolvedCode = canonical?.code ?? error.code ?? 'TRANSPORT_ERROR';
        const resolvedMessage = canonical?.message ?? error.message ?? 'Falha ao enviar mensagem.';
        const status = (() => {
          switch (canonical?.code) {
            case 'RATE_LIMITED':
              return 429;
            case 'BROKER_TIMEOUT':
              return error.status === 504 ? 504 : 408;
            case 'INVALID_TO':
              return 422;
            case 'INSTANCE_NOT_CONNECTED':
              return 409;
            case 'TRANSPORT_NOT_CONFIGURED':
              return 503;
            case 'UNSUPPORTED_OPERATION':
              return 400;
            default:
              if (typeof error.status === 'number' && error.status >= 400 && error.status < 600) {
                return error.status;
              }
              return 502;
          }
        })();

        res.locals.errorCode = resolvedCode;
        res.status(status).json({
          success: false,
          error: {
            code: resolvedCode,
            message: resolvedMessage,
            details: error.requestId ? { requestId: error.requestId } : undefined,
          },
        });
        return;
      }

      throw error;
    }
  })
);

export { router as whatsappMessagesRouter };
