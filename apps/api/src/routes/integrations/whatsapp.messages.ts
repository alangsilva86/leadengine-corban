import express, { Router, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';

import { asyncHandler } from '../../middleware/error-handler';
import { requireTenant } from '../../middleware/auth';
import { prisma } from '../../lib/prisma';
import {
  SendByInstanceSchema,
  SendGenericMessageSchema,
  normalizePayload,
} from '../../dtos/message-schemas';
import { sendAdHoc } from '../../services/ticket-service';
import {
  WhatsAppBrokerError,
  translateWhatsAppBrokerError,
} from '../../services/whatsapp-broker-client';
import { NotFoundError } from '@ticketz/core';
import { whatsappHttpRequestsCounter } from '../../lib/metrics';
import { logger } from '../../config/logger';
import { respondWithValidationError } from '../../utils/http-validation';

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

const router: Router = Router();

router.use(express.json({ limit: '1mb' }));
router.use(instrumentationMiddleware);

router.post(
  '/integrations/whatsapp/instances/:instanceId/messages',
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const { instanceId } = req.params;
    const tenantId = req.user!.tenantId;

    const instance = await prisma.whatsAppInstance.findUnique({ where: { id: instanceId } });

    if (!instance || instance.tenantId !== tenantId) {
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

    const parsedResult = SendByInstanceSchema.safeParse(req.body ?? {});
    if (!parsedResult.success) {
      respondWithValidationError(res, parsedResult.error.issues);
      return;
    }

    const parsed = parsedResult.data;

    const idempotencyKey = parsed.idempotencyKey ?? req.get('Idempotency-Key') ?? undefined;
    const payload = normalizePayload(parsed.payload);

    try {
      const response = await sendAdHoc({
        tenantId,
        operatorId: req.user!.id,
        instanceId: instance.id,
        to: parsed.to,
        payload,
        idempotencyKey,
      });

      res.status(202).json(response);
    } catch (error) {
      if (error instanceof WhatsAppBrokerError) {
        const normalized = translateWhatsAppBrokerError(error);
        const resolvedCode = normalized?.code ?? error.code ?? 'BROKER_ERROR';
        const resolvedMessage = normalized?.message ?? error.message ?? 'Falha ao enviar mensagem.';
        const status = (() => {
          if (normalized?.code === 'RATE_LIMITED') {
            return 429;
          }
          if (normalized?.code === 'BROKER_TIMEOUT') {
            return error.brokerStatus === 504 ? 504 : 408;
          }
          if (normalized?.code === 'INVALID_TO') {
            return 422;
          }
          if (normalized?.code === 'INSTANCE_NOT_CONNECTED') {
            return 409;
          }
          if (typeof error.brokerStatus === 'number' && error.brokerStatus >= 400 && error.brokerStatus < 600) {
            return error.brokerStatus;
          }
          return 502;
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
