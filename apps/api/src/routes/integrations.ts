
import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/error-handler';
import { requireTenant } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import {
  whatsappBrokerClient,
  WhatsAppBrokerNotConfiguredError,
  WhatsAppBrokerError,
  type WhatsAppStatus,
  type WhatsAppBrokerInstanceSnapshot,
  type DeleteInstanceOptions,
} from '../services/whatsapp-broker-client';
import { emitToTenant } from '../lib/socket-registry';
import { prisma } from '../lib/prisma';
import { logger } from '../config/logger';
import { respondWithValidationError } from '../utils/http-validation';
import { normalizePhoneNumber, PhoneNormalizationError } from '../utils/phone';
import { whatsappHttpRequestsCounter } from '../lib/metrics';
import { getWhatsAppTransport } from '../features/whatsapp-transport';
import { z, type ZodIssue } from 'zod';
import {
  normalizeQueryValue,
  normalizeBooleanValue,
  resolveRequestTenantId,
  resolveRequestActorId,
  resolveDefaultInstanceId,
  looksLikeWhatsAppJid,
  readInstanceIdParam,
  readBrokerErrorStatus,
  hasErrorName,
  isBrokerAlreadyDisconnectedError,
  isBrokerMissingInstanceError,
  INVALID_INSTANCE_ID_MESSAGE,
  instanceIdParamValidator,
  createWhatsAppInstanceSchema,
  createWhatsAppInstance,
  executeSideEffects,
  WhatsAppInstanceAlreadyExistsError,
  WhatsAppInstanceInvalidPayloadError,
  respondWhatsAppStorageUnavailable,
  respondWhatsAppNotConfigured,
  handleWhatsAppIntegrationError,
  describeErrorForLog,
  logWhatsAppStorageError,
  respondWhatsAppBrokerFailure,
  respondLegacyEndpointGone,
  collectInstancesForTenant,
  NormalizedInstance,
  buildInstanceStatusPayload,
  fetchStatusWithBrokerQr,
  normalizeInstanceStatusResponse,
  normalizeQr,
  extractQrImageBuffer,
  disconnectStoredInstance,
  deleteStoredInstance,
  resolveInstanceOperationContext,
  StoredInstance,
  InstanceOperationContext,
  serializeStoredInstance,
  normalizeStatusCountsData,
  normalizeRateUsageData,
  collectNumericFromSources,
  syncInstancesFromBroker,
  archiveInstanceSnapshot,
  scheduleWhatsAppDisconnectRetry,
  clearWhatsAppDisconnectRetry,
  removeCachedSnapshot,
  clearInstanceArchive,
} from '../modules/whatsapp/instances/router-coordinator';


const router: Router = Router();

// ============================================================================
// WhatsApp Routes
// ============================================================================

// POST /api/integrations/whatsapp/instances - Create WhatsApp instance
router.post(
  '/whatsapp/instances',
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = resolveRequestTenantId(req);
    const actorId = resolveRequestActorId(req);

    const parsedBody = createWhatsAppInstanceSchema.safeParse(req.body ?? {});
    if (!parsedBody.success) {
      respondWithValidationError(res, parsedBody.error.issues);
      return;
    }

    logger.info('whatsapp.instances.create.request', {
      tenantId,
      actorId,
      name: parsedBody.data.name,
      instanceId: parsedBody.data.id ?? parsedBody.data.name ?? null,
    });

    try {
      const result = await createWhatsAppInstance({
        tenantId,
        actorId,
        input: parsedBody.data,
      });

      await executeSideEffects(result.sideEffects, {
        tenantId: result.context.tenantId,
        actorId: result.context.actorId,
        instanceId: result.context.instanceId,
        brokerId: result.context.brokerId,
      });

      res.status(201).json({
        success: true,
        data: result.serialized,
      });
    } catch (error: unknown) {
      if (error instanceof WhatsAppInstanceAlreadyExistsError) {
        res.status(error.status).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.suggestedId ? { suggestedId: error.suggestedId } : undefined,
          },
        });
        return;
      }

      if (error instanceof WhatsAppInstanceInvalidPayloadError) {
        res.status(error.status).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }

      if (error instanceof WhatsAppBrokerNotConfiguredError) {
        if (handleWhatsAppIntegrationError(res, error)) {
          return;
        }
      }

      if (error instanceof WhatsAppBrokerError) {
        logger.error('whatsapp.instances.create.brokerFailed', {
          tenantId,
          actorId,
          instanceId: parsedBody.data.id ?? parsedBody.data.name ?? null,
          error: describeErrorForLog(error),
        });
        respondWhatsAppBrokerFailure(res, error);
        return;
      }

      if (respondWhatsAppStorageUnavailable(res, error)) {
        return;
      }

      logger.error('whatsapp.instances.create.unexpected', {
        tenantId,
        actorId,
        instanceId: parsedBody.data.id ?? parsedBody.data.name ?? null,
        error: describeErrorForLog(error),
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INSTANCE_CREATE_FAILED',
          message: 'Falha inesperada ao criar instância WhatsApp.',
        },
      });
    }
  })
);

// GET /api/integrations/whatsapp/instances - List WhatsApp instances
// simple in-memory rate-limiter (per-process)
const instancesRateWindow = new Map<string, number[]>();
const rateLimitInstances = (req: Request, res: Response, next: Function) => {
  const tenantId = resolveRequestTenantId(req);
  const refreshQuery = req.query.refresh;
  const refreshToken = Array.isArray(refreshQuery) ? refreshQuery[0] : refreshQuery;
  const normalizedRefresh = typeof refreshToken === 'string' ? refreshToken.trim().toLowerCase() : null;
  const forced = normalizedRefresh === '1' || normalizedRefresh === 'true' || normalizedRefresh === 'yes';
  const mode = typeof req.query.mode === 'string' ? req.query.mode : 'db';
  const key = `${tenantId}|${forced ? 'refresh' : mode}`;
  const now = Date.now();
  const windowMs = forced ? 60_000 : mode === 'sync' ? 30_000 : 15_000;
  const max = forced ? 5 : mode === 'sync' ? 3 : 10;
  const arr = (instancesRateWindow.get(key) ?? []).filter(ts => now - ts < windowMs);
  if (arr.length >= max) {
    res.status(429).json({ success: false, error: { code: 'RATE_LIMITED', message: 'Muitas requisições. Tente novamente em instantes.' } });
    return;
  }
  arr.push(now);
  instancesRateWindow.set(key, arr);
  next();
};

router.get(
  '/whatsapp/instances',
  requireTenant,
  rateLimitInstances as any,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = resolveRequestTenantId(req);
    const t0 = Date.now();

    // refresh override (legacy)
    const refreshQuery = req.query.refresh;
    const refreshToken = Array.isArray(refreshQuery) ? refreshQuery[0] : refreshQuery;
    const normalizedRefresh = typeof refreshToken === 'string' ? refreshToken.trim().toLowerCase() : null;
    const refreshRequested = normalizedRefresh === '1' || normalizedRefresh === 'true' || normalizedRefresh === 'yes';

    // mode = db | snapshot | sync
    const mode = typeof req.query.mode === 'string' ? (req.query.mode as string) : 'db';
    const baseOptions =
      mode === 'sync' ? { refresh: true, fetchSnapshots: true } :
      mode === 'snapshot' ? { refresh: false, fetchSnapshots: true } :
      { refresh: false, fetchSnapshots: false }; // db default

    // if ?refresh was provided, override options fully
    const collectionOptions = { ...baseOptions };
    if (normalizedRefresh !== null) {
      collectionOptions.refresh = refreshRequested;
      collectionOptions.fetchSnapshots = refreshRequested;
    }

    logger.info('whatsapp.instances.list.request', {
      tenantId,
      refreshRequested,
      mode,
      options: collectionOptions,
    });

    try {
      const result = await collectInstancesForTenant(tenantId, collectionOptions);
      let instancesResult = result.instances;

      // selective fields: basic | metrics | full
      const fields = typeof req.query.fields === 'string' ? req.query.fields : 'basic';

      const pickBasic = (i: NormalizedInstance) => ({
        id: i.id,
        tenantId: i.tenantId,
        name: i.name,
        status: i.status,
        connected: i.connected,
        phoneNumber: i.phoneNumber,
        lastActivity: i.lastActivity,
      });

      const pickMetrics = (i: NormalizedInstance) => ({
        ...pickBasic(i),
        metrics: i.metrics ?? null,
        rate: i.rate ?? null,
      });

      const instances =
        fields === 'full'
          ? instancesResult
          : fields === 'metrics'
            ? instancesResult.map(pickMetrics)
            : instancesResult.map(pickBasic);

      const payload = {
        success: true,
        data: { instances },
        meta: {
          tenantId,
          mode,
          refreshRequested,
          shouldRefresh: result.shouldRefresh ?? false,
          fetchSnapshots: result.fetchSnapshots ?? false,
          synced: result.synced ?? false,
          instancesCount: instances.length,
          durationMs: Date.now() - t0,
        },
      };

      logger.info('whatsapp.instances.list.response', {
        tenantId,
        mode,
        refreshRequested,
        shouldRefresh: result.shouldRefresh ?? false,
        fetchSnapshots: result.fetchSnapshots ?? false,
        synced: result.synced ?? false,
        instancesCount: instances.length,
        durationMs: payload.meta.durationMs,
      });

      res.status(200).json(payload);
    } catch (error: unknown) {
      if (handleWhatsAppIntegrationError(res, error)) {
        return;
      }

      logger.error('whatsapp.instances.list.unexpected', {
        tenantId,
        error: describeErrorForLog(error),
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Falha ao listar instâncias do WhatsApp.',
        },
      });
    }
  })
);

router.get(
  '/whatsapp/instances/:id/status',
  requireTenant,
  instanceIdParamValidator(),
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const instanceId = readInstanceIdParam(req);
    if (!instanceId) {
      const issues: ZodIssue[] = [
        {
          code: z.ZodIssueCode.custom,
          path: ['params', 'id'],
          message: INVALID_INSTANCE_ID_MESSAGE,
        },
      ];
      respondWithValidationError(res, issues);
      return;
    }

    const refreshQuery = normalizeBooleanValue(req.query.refresh);
    const snapshotsQuery = normalizeBooleanValue(req.query.snapshots);
    const refresh = refreshQuery === null ? true : refreshQuery;
    const fetchSnapshots = snapshotsQuery === null ? true : snapshotsQuery;
    const tenantId = resolveRequestTenantId(req);
    const startedAt = Date.now();

    logger.info('whatsapp.instances.status.request', {
      tenantId,
      instanceId,
      refresh,
      fetchSnapshots,
    });

    let stored: StoredInstance | null = null;
    try {
      stored = (await prisma.whatsAppInstance.findFirst({
        where: {
          tenantId,
          id: instanceId,
        },
      })) as StoredInstance | null;
    } catch (error: unknown) {
      if (respondWhatsAppStorageUnavailable(res, error)) {
        return;
      }
      throw error;
    }

    if (!stored) {
      logger.warn('whatsapp.instances.status.notFound', {
        tenantId,
        instanceId,
      });
      res.status(404).json({
        success: false,
        error: {
          code: 'INSTANCE_NOT_FOUND',
          message: 'Instância não localizada para o tenant informado.',
        },
      });
      return;
    }

    try {
      const context = await resolveInstanceOperationContext(tenantId, stored, {
        refresh,
        fetchSnapshots,
      });

      const payload = buildInstanceStatusPayload(context);
      const durationMs = Date.now() - startedAt;

      logger.info('whatsapp.instances.status.success', {
        tenantId,
        instanceId,
        refresh,
        fetchSnapshots,
        status: payload.status.status,
        connected: payload.connected,
        durationMs,
      });

      res.status(200).json({
        success: true,
        data: payload,
        meta: {
          tenantId,
          instanceId,
          refresh,
          fetchSnapshots,
          durationMs,
        },
      });
    } catch (error: unknown) {
      if (handleWhatsAppIntegrationError(res, error)) {
        return;
      }

      if (respondWhatsAppStorageUnavailable(res, error)) {
        return;
      }

      const durationMs = Date.now() - startedAt;

      logger.error('whatsapp.instances.status.failed', {
        tenantId,
        instanceId,
        refresh,
        fetchSnapshots,
        durationMs,
        error: describeErrorForLog(error),
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INSTANCE_STATUS_FAILED',
          message: 'Falha ao recuperar status da instância WhatsApp.',
        },
      });
    }
  })
);

router.get(
  '/whatsapp/instances/:id/qr',
  requireTenant,
  instanceIdParamValidator(),
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const instanceId = readInstanceIdParam(req);
    if (!instanceId) {
      const issues: ZodIssue[] = [
        {
          code: z.ZodIssueCode.custom,
          path: ['params', 'id'],
          message: INVALID_INSTANCE_ID_MESSAGE,
        },
      ];
      respondWithValidationError(res, issues);
      return;
    }

    const refreshQuery = normalizeBooleanValue(req.query.refresh);
    const snapshotsQuery = normalizeBooleanValue(req.query.snapshots);
    const refresh = refreshQuery === null ? true : refreshQuery;
    const fetchSnapshots = snapshotsQuery === null ? true : snapshotsQuery;
    const tenantId = resolveRequestTenantId(req);
    const startedAt = Date.now();

    logger.info('whatsapp.instances.qr.request', {
      tenantId,
      instanceId,
      refresh,
      fetchSnapshots,
    });

    let stored: StoredInstance | null = null;
    try {
      stored = (await prisma.whatsAppInstance.findFirst({
        where: {
          tenantId,
          id: instanceId,
        },
      })) as StoredInstance | null;
    } catch (error: unknown) {
      if (respondWhatsAppStorageUnavailable(res, error)) {
        return;
      }
      throw error;
    }

    if (!stored) {
      logger.warn('whatsapp.instances.qr.notFound', {
        tenantId,
        instanceId,
      });
      res.status(404).json({
        success: false,
        error: {
          code: 'INSTANCE_NOT_FOUND',
          message: 'Instância não localizada para o tenant informado.',
        },
      });
      return;
    }

    const qrUnavailable = () => {
      res.status(404).json({
        success: false,
        error: {
          code: 'QR_NOT_AVAILABLE',
          message: 'QR Code não disponível no momento. Tente novamente em instantes.',
        },
      });
    };

    try {
      const { context, qr } = await fetchStatusWithBrokerQr(tenantId, stored, {
        refresh,
        fetchSnapshots,
      });

      if (!qr.qr && !qr.qrCode) {
        logger.warn('whatsapp.instances.qr.empty', {
          tenantId,
          instanceId,
          refresh,
          fetchSnapshots,
        });
        qrUnavailable();
        return;
      }

      const payload = buildInstanceStatusPayload(context, qr);
      const durationMs = Date.now() - startedAt;

      logger.info('whatsapp.instances.qr.success', {
        tenantId,
        instanceId,
        refresh,
        fetchSnapshots,
        connected: payload.connected,
        durationMs,
      });

      res.status(200).json({
        success: true,
        data: payload,
        meta: {
          tenantId,
          instanceId,
          refresh,
          fetchSnapshots,
          durationMs,
        },
      });
    } catch (error: unknown) {
      const context = (error as { __context__?: InstanceOperationContext }).__context__ ?? null;
      if (error instanceof WhatsAppBrokerNotConfiguredError) {
        if (handleWhatsAppIntegrationError(res, error)) {
          return;
        }
      } else if (error instanceof WhatsAppBrokerError || hasErrorName(error, 'WhatsAppBrokerError')) {
        const brokerError = error as WhatsAppBrokerError;
        const status = readBrokerErrorStatus(brokerError);
        if (status === 404 || status === 410) {
          logger.warn('whatsapp.instances.qr.brokerNotReady', {
            tenantId,
            instanceId,
            refresh,
            fetchSnapshots,
            status,
          });
          qrUnavailable();
          return;
        }

        logger.error('whatsapp.instances.qr.brokerFailed', {
          tenantId,
          instanceId,
          refresh,
          fetchSnapshots,
          status,
          code: brokerError.code,
          requestId: brokerError.requestId,
          error: describeErrorForLog(brokerError),
        });
        respondWhatsAppBrokerFailure(res, brokerError);
        return;
      } else if (handleWhatsAppIntegrationError(res, error)) {
        return;
      } else if (respondWhatsAppStorageUnavailable(res, error)) {
        return;
      }

      const durationMs = Date.now() - startedAt;

      logger.error('whatsapp.instances.qr.failed', {
        tenantId,
        instanceId,
        refresh,
        fetchSnapshots,
        durationMs,
        error: describeErrorForLog(error),
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INSTANCE_QR_FAILED',
          message: 'Falha ao recuperar QR Code da instância WhatsApp.',
        },
        ...(context
          ? {
              data: buildInstanceStatusPayload(context),
            }
          : {}),
      });
    }
  })
);

router.get(
  '/whatsapp/instances/:id/qr.png',
  requireTenant,
  instanceIdParamValidator(),
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const instanceId = readInstanceIdParam(req);
    if (!instanceId) {
      const issues: ZodIssue[] = [
        {
          code: z.ZodIssueCode.custom,
          path: ['params', 'id'],
          message: INVALID_INSTANCE_ID_MESSAGE,
        },
      ];
      respondWithValidationError(res, issues);
      return;
    }

    const refreshQuery = normalizeBooleanValue(req.query.refresh);
    const snapshotsQuery = normalizeBooleanValue(req.query.snapshots);
    const refresh = refreshQuery === null ? true : refreshQuery;
    const fetchSnapshots = snapshotsQuery === null ? true : snapshotsQuery;
    const tenantId = resolveRequestTenantId(req);
    const startedAt = Date.now();

    logger.info('whatsapp.instances.qrImage.request', {
      tenantId,
      instanceId,
      refresh,
      fetchSnapshots,
    });

    let stored: StoredInstance | null = null;
    try {
      stored = (await prisma.whatsAppInstance.findFirst({
        where: {
          tenantId,
          id: instanceId,
        },
      })) as StoredInstance | null;
    } catch (error: unknown) {
      if (respondWhatsAppStorageUnavailable(res, error)) {
        return;
      }
      throw error;
    }

    if (!stored) {
      logger.warn('whatsapp.instances.qrImage.notFound', {
        tenantId,
        instanceId,
      });
      res.sendStatus(404);
      return;
    }

    try {
      const { context, qr } = await fetchStatusWithBrokerQr(tenantId, stored, {
        refresh,
        fetchSnapshots,
      });

      const buffer = extractQrImageBuffer(qr);
      if (!buffer) {
        logger.warn('whatsapp.instances.qrImage.empty', {
          tenantId,
          instanceId,
          refresh,
          fetchSnapshots,
        });
        res.sendStatus(404);
        return;
      }

      const durationMs = Date.now() - startedAt;

      logger.info('whatsapp.instances.qrImage.success', {
        tenantId,
        instanceId,
        refresh,
        fetchSnapshots,
        connected: context.status.connected,
        durationMs,
      });

      res.setHeader('content-type', 'image/png');
      res.status(200).send(buffer);
    } catch (error: unknown) {
      if (error instanceof WhatsAppBrokerNotConfiguredError) {
        if (handleWhatsAppIntegrationError(res, error)) {
          return;
        }
      } else if (error instanceof WhatsAppBrokerError || hasErrorName(error, 'WhatsAppBrokerError')) {
        const brokerError = error as WhatsAppBrokerError;
        const status = readBrokerErrorStatus(brokerError);
        if (status === 404 || status === 410) {
          logger.warn('whatsapp.instances.qrImage.brokerNotReady', {
            tenantId,
            instanceId,
            refresh,
            fetchSnapshots,
            status,
          });
          res.sendStatus(404);
          return;
        }

        logger.error('whatsapp.instances.qrImage.brokerFailed', {
          tenantId,
          instanceId,
          refresh,
          fetchSnapshots,
          status,
          code: brokerError.code,
          requestId: brokerError.requestId,
          error: describeErrorForLog(brokerError),
        });
        respondWhatsAppBrokerFailure(res, brokerError);
        return;
      } else if (handleWhatsAppIntegrationError(res, error)) {
        return;
      } else if (respondWhatsAppStorageUnavailable(res, error)) {
        return;
      }

      const durationMs = Date.now() - startedAt;

      logger.error('whatsapp.instances.qrImage.failed', {
        tenantId,
        instanceId,
        refresh,
        fetchSnapshots,
        durationMs,
        error: describeErrorForLog(error),
      });

      res.sendStatus(500);
    }
  })
);

router.get(
  '/whatsapp/instances/qr',
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = resolveRequestTenantId(req);
    const instanceId = resolveDefaultInstanceId();
    const refreshQuery = normalizeBooleanValue(req.query.refresh);
    const snapshotsQuery = normalizeBooleanValue(req.query.snapshots);
    const refresh = refreshQuery === null ? true : refreshQuery;
    const fetchSnapshots = snapshotsQuery === null ? true : snapshotsQuery;
    const startedAt = Date.now();

    logger.info('whatsapp.instances.qrDefault.request', {
      tenantId,
      instanceId,
      refresh,
      fetchSnapshots,
    });

    let stored: StoredInstance | null = null;
    try {
      stored = (await prisma.whatsAppInstance.findFirst({
        where: {
          tenantId,
          id: instanceId,
        },
      })) as StoredInstance | null;
    } catch (error: unknown) {
      if (respondWhatsAppStorageUnavailable(res, error)) {
        return;
      }
      throw error;
    }

    if (!stored) {
      logger.warn('whatsapp.instances.qrDefault.notFound', {
        tenantId,
        instanceId,
      });
      res.status(404).json({
        success: false,
        error: {
          code: 'INSTANCE_NOT_FOUND',
          message: 'Instância padrão não localizada para o tenant informado.',
        },
      });
      return;
    }

    const qrUnavailable = () => {
      res.status(404).json({
        success: false,
        error: {
          code: 'QR_NOT_AVAILABLE',
          message: 'QR Code não disponível no momento. Tente novamente em instantes.',
        },
      });
    };

    try {
      const { context, qr } = await fetchStatusWithBrokerQr(tenantId, stored, {
        refresh,
        fetchSnapshots,
      });

      if (!qr.qr && !qr.qrCode) {
        logger.warn('whatsapp.instances.qrDefault.empty', {
          tenantId,
          refresh,
          fetchSnapshots,
        });
        qrUnavailable();
        return;
      }

      const payload = buildInstanceStatusPayload(context, qr);
      const durationMs = Date.now() - startedAt;

      logger.info('whatsapp.instances.qrDefault.success', {
        tenantId,
        refresh,
        fetchSnapshots,
        connected: payload.connected,
        durationMs,
      });

      res.status(200).json({
        success: true,
        data: {
          ...payload,
          instanceId: payload.instance.id,
        },
        meta: {
          tenantId,
          instanceId: payload.instance.id,
          refresh,
          fetchSnapshots,
          durationMs,
        },
      });
    } catch (error: unknown) {
      if (error instanceof WhatsAppBrokerNotConfiguredError) {
        if (handleWhatsAppIntegrationError(res, error)) {
          return;
        }
      } else if (error instanceof WhatsAppBrokerError || hasErrorName(error, 'WhatsAppBrokerError')) {
        const brokerError = error as WhatsAppBrokerError;
        const status = readBrokerErrorStatus(brokerError);
        if (status === 404 || status === 410) {
          logger.warn('whatsapp.instances.qrDefault.brokerNotReady', {
            tenantId,
            refresh,
            fetchSnapshots,
            status,
          });
          qrUnavailable();
          return;
        }

        logger.error('whatsapp.instances.qrDefault.brokerFailed', {
          tenantId,
          refresh,
          fetchSnapshots,
          status,
          code: brokerError.code,
          requestId: brokerError.requestId,
          error: describeErrorForLog(brokerError),
        });
        respondWhatsAppBrokerFailure(res, brokerError);
        return;
      } else if (handleWhatsAppIntegrationError(res, error)) {
        return;
      } else if (respondWhatsAppStorageUnavailable(res, error)) {
        return;
      }

      const durationMs = Date.now() - startedAt;

      logger.error('whatsapp.instances.qrDefault.failed', {
        tenantId,
        refresh,
        fetchSnapshots,
        durationMs,
        error: describeErrorForLog(error),
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INSTANCE_QR_FAILED',
          message: 'Falha ao recuperar QR Code da instância WhatsApp.',
        },
      });
    }
  })
);

router.get(
  '/whatsapp/instances/qr.png',
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = resolveRequestTenantId(req);
    const instanceId = resolveDefaultInstanceId();
    const refreshQuery = normalizeBooleanValue(req.query.refresh);
    const snapshotsQuery = normalizeBooleanValue(req.query.snapshots);
    const refresh = refreshQuery === null ? true : refreshQuery;
    const fetchSnapshots = snapshotsQuery === null ? true : snapshotsQuery;
    const startedAt = Date.now();

    logger.info('whatsapp.instances.qrDefaultImage.request', {
      tenantId,
      instanceId,
      refresh,
      fetchSnapshots,
    });

    let stored: StoredInstance | null = null;
    try {
      stored = (await prisma.whatsAppInstance.findFirst({
        where: {
          tenantId,
          id: instanceId,
        },
      })) as StoredInstance | null;
    } catch (error: unknown) {
      if (respondWhatsAppStorageUnavailable(res, error)) {
        return;
      }
      throw error;
    }

    if (!stored) {
      logger.warn('whatsapp.instances.qrDefaultImage.notFound', {
        tenantId,
        instanceId,
      });
      res.sendStatus(404);
      return;
    }

    try {
      const { qr } = await fetchStatusWithBrokerQr(tenantId, stored, {
        refresh,
        fetchSnapshots,
      });
      const buffer = extractQrImageBuffer(qr);

      if (!buffer) {
        logger.warn('whatsapp.instances.qrDefaultImage.empty', {
          tenantId,
          instanceId,
          refresh,
          fetchSnapshots,
        });
        res.sendStatus(404);
        return;
      }

      const durationMs = Date.now() - startedAt;

      logger.info('whatsapp.instances.qrDefaultImage.success', {
        tenantId,
        instanceId,
        refresh,
        fetchSnapshots,
        durationMs,
      });

      res.setHeader('content-type', 'image/png');
      res.status(200).send(buffer);
    } catch (error: unknown) {
      if (error instanceof WhatsAppBrokerNotConfiguredError) {
        if (handleWhatsAppIntegrationError(res, error)) {
          return;
        }
      } else if (error instanceof WhatsAppBrokerError || hasErrorName(error, 'WhatsAppBrokerError')) {
        const brokerError = error as WhatsAppBrokerError;
        const status = readBrokerErrorStatus(brokerError);
        if (status === 404 || status === 410) {
          logger.warn('whatsapp.instances.qrDefaultImage.brokerNotReady', {
            tenantId,
            instanceId,
            refresh,
            fetchSnapshots,
            status,
          });
          res.sendStatus(404);
          return;
        }

        logger.error('whatsapp.instances.qrDefaultImage.brokerFailed', {
          tenantId,
          instanceId,
          refresh,
          fetchSnapshots,
          status,
          code: brokerError.code,
          requestId: brokerError.requestId,
          error: describeErrorForLog(brokerError),
        });
        respondWhatsAppBrokerFailure(res, brokerError);
        return;
      } else if (handleWhatsAppIntegrationError(res, error)) {
        return;
      } else if (respondWhatsAppStorageUnavailable(res, error)) {
        return;
      }

      const durationMs = Date.now() - startedAt;

      logger.error('whatsapp.instances.qrDefaultImage.failed', {
        tenantId,
        instanceId,
        refresh,
        fetchSnapshots,
        durationMs,
        error: describeErrorForLog(error),
      });

      res.sendStatus(500);
    }
  })
);

router.post(
  '/whatsapp/instances/disconnect',
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = resolveRequestTenantId(req);
    const actorId = resolveRequestActorId(req);
    const defaultInstanceId = resolveDefaultInstanceId();

    try {
      const stored = await prisma.whatsAppInstance.findFirst({
        where: {
          tenantId,
          id: defaultInstanceId,
        },
      });

      if (!stored) {
        res.status(404).json({
          success: false,
          error: {
            code: 'DEFAULT_INSTANCE_NOT_FOUND',
            message: 'Instância WhatsApp padrão não localizada para o tenant informado.',
          },
        });
        return;
      }

      const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
      const wipeValue =
        normalizeBooleanValue(req.query.wipe) ?? normalizeBooleanValue(body.wipe);
      const disconnectOptions: { wipe?: boolean } =
        wipeValue === null ? {} : { wipe: wipeValue === true };

      const result = await disconnectStoredInstance(tenantId, stored, actorId, disconnectOptions);

      if (result.outcome === 'retry') {
        res.status(202).json({
          success: true,
          data: {
            instanceId: stored.id,
            disconnected: false,
            pending: true,
            existed: true,
            connected: null,
            retry: result.retry,
          },
        });
        return;
      }

      try {
        await clearWhatsAppDisconnectRetry(tenantId, stored.id);
      } catch (error: unknown) {
        if (!logWhatsAppStorageError('disconnect.clearRetry', error, { tenantId, instanceId: stored.id })) {
          throw error;
        }
      }

      await removeCachedSnapshot(tenantId, stored.id, stored.brokerId);

      const { context } = result;

      res.status(200).json({
        success: true,
        data: {
          instanceId: context.instance.id,
          disconnected: !context.status.connected,
          pending: false,
          existed: true,
          connected: context.status.connected,
          status: context.status,
          qr: context.qr,
          instance: context.instance,
          instances: context.instances,
        },
      });
    } catch (error: unknown) {
      if (handleWhatsAppIntegrationError(res, error)) {
        return;
      }

      logger.error('whatsapp.instances.disconnect.defaultFailed', {
        tenantId,
        actorId,
        instanceId: defaultInstanceId,
        error: describeErrorForLog(error),
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INSTANCE_DISCONNECT_FAILED',
          message: 'Falha ao desconectar instância WhatsApp.',
        },
      });
    }
  })
);

router.post(
  '/whatsapp/instances/:id/disconnect',
  requireTenant,
  instanceIdParamValidator(),
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const instanceId = readInstanceIdParam(req);
    if (!instanceId) {
      const issues: ZodIssue[] = [
        {
          code: z.ZodIssueCode.custom,
          path: ['params', 'id'],
          message: INVALID_INSTANCE_ID_MESSAGE,
        },
      ];
      respondWithValidationError(res, issues);
      return;
    }

    const tenantId = resolveRequestTenantId(req);
    const actorId = resolveRequestActorId(req);
    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
    const wipeValue =
      normalizeBooleanValue(req.query.wipe) ?? normalizeBooleanValue(body.wipe);
    const disconnectOptions: { wipe?: boolean } =
      wipeValue === null ? {} : { wipe: wipeValue === true };

    if (looksLikeWhatsAppJid(instanceId)) {
      try {
        try {
          whatsappHttpRequestsCounter?.inc?.();
        } catch {
          // optional metric
        }

        await whatsappBrokerClient.disconnectInstance(instanceId, {
          instanceId,
          ...(disconnectOptions ?? {}),
        });

        try {
          await clearWhatsAppDisconnectRetry(tenantId, instanceId);
        } catch (error: unknown) {
          if (!logWhatsAppStorageError('disconnect.clearRetry', error, { tenantId, instanceId })) {
            throw error;
          }
        }

        await removeCachedSnapshot(tenantId, instanceId, instanceId);

        res.status(200).json({
          success: true,
          data: {
            instanceId,
            disconnected: true,
            pending: false,
            existed: true,
            connected: null,
          },
        });
        return;
      } catch (error: unknown) {
        if (error instanceof WhatsAppBrokerNotConfiguredError) {
          if (handleWhatsAppIntegrationError(res, error)) {
            return;
          }
        }

        if (error instanceof WhatsAppBrokerError || hasErrorName(error, 'WhatsAppBrokerError')) {
          const brokerError = error as WhatsAppBrokerError;
          const brokerStatus = readBrokerErrorStatus(brokerError);

          if (isBrokerAlreadyDisconnectedError(brokerError) || brokerStatus === 404 || brokerStatus === 410) {
            res.status(200).json({
              success: true,
              data: {
                instanceId,
                disconnected: true,
                pending: false,
                existed: false,
                connected: null,
              },
            });
            return;
          }

          if (brokerStatus !== null && brokerStatus >= 500) {
            const requestedAt = new Date().toISOString();
            await scheduleWhatsAppDisconnectRetry(tenantId, {
              instanceId,
              status: brokerStatus,
              requestId: brokerError.requestId ?? null,
              wipe: Boolean(disconnectOptions.wipe),
              requestedAt,
            });

            res.status(202).json({
              success: true,
              data: {
                instanceId,
                disconnected: false,
                pending: true,
                existed: true,
                connected: null,
                retry: {
                  status: brokerStatus,
                  requestId: brokerError.requestId ?? null,
                },
              },
            });
            return;
          }

          logger.error('whatsapp.instances.disconnect.brokerFailed', {
            tenantId,
            actorId,
            instanceId,
            status: brokerStatus,
            code: brokerError.code,
            requestId: brokerError.requestId,
            error: describeErrorForLog(brokerError),
          });

          res.status(502).json({
            success: false,
            error: {
              code: 'WHATSAPP_BROKER_DISCONNECT_FAILED',
              message: 'Falha ao desconectar instância via broker WhatsApp.',
            },
          });
          return;
        }

        if (handleWhatsAppIntegrationError(res, error)) {
          return;
        }

        logger.error('whatsapp.instances.disconnect.unexpected', {
          tenantId,
          actorId,
          instanceId,
          error: describeErrorForLog(error),
        });

        res.status(500).json({
          success: false,
          error: {
            code: 'INSTANCE_DISCONNECT_FAILED',
            message: 'Falha ao desconectar instância WhatsApp.',
          },
        });
        return;
      }
    }

    try {
      const stored = await prisma.whatsAppInstance.findFirst({
        where: {
          tenantId,
          id: instanceId,
        },
      });

      if (!stored) {
        res.status(404).json({
          success: false,
          error: {
            code: 'INSTANCE_NOT_FOUND',
            message: 'Instância não localizada para o tenant informado.',
          },
        });
        return;
      }

      const result = await disconnectStoredInstance(tenantId, stored, actorId, disconnectOptions);

      if (result.outcome === 'retry') {
        res.status(202).json({
          success: true,
          data: {
            instanceId: stored.id,
            disconnected: false,
            pending: true,
            existed: true,
            connected: null,
            retry: result.retry,
          },
        });
        return;
      }

      try {
        await clearWhatsAppDisconnectRetry(tenantId, stored.id);
      } catch (error: unknown) {
        if (!logWhatsAppStorageError('disconnect.clearRetry', error, { tenantId, instanceId: stored.id })) {
          throw error;
        }
      }

      await removeCachedSnapshot(tenantId, stored.id, stored.brokerId);

      const { context } = result;

      res.status(200).json({
        success: true,
        data: {
          instanceId: context.instance.id,
          disconnected: !context.status.connected,
          pending: false,
          existed: true,
          connected: context.status.connected,
          status: context.status,
          qr: context.qr,
          instance: context.instance,
          instances: context.instances,
        },
      });
    } catch (error: unknown) {
      if (handleWhatsAppIntegrationError(res, error)) {
        return;
      }

      logger.error('whatsapp.instances.disconnect.failed', {
        tenantId,
        actorId,
        instanceId,
        error: describeErrorForLog(error),
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INSTANCE_DISCONNECT_FAILED',
          message: 'Falha ao desconectar instância WhatsApp.',
        },
      });
    }
  })
);

export const integrationsRouter = router;

export const __testing = {
  serializeStoredInstance,
  normalizeStatusCountsData,
  normalizeRateUsageData,
  collectNumericFromSources,
  syncInstancesFromBroker,
  collectInstancesForTenant,
  resolveInstanceOperationContext,
  disconnectStoredInstance,
  deleteStoredInstance,
  archiveInstanceSnapshot,
  clearInstanceArchive,
  clearWhatsAppDisconnectRetry,
  removeCachedSnapshot,
};

router.delete(
  '/whatsapp/instances/:id',
  requireTenant,
  instanceIdParamValidator(),
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const instanceId = readInstanceIdParam(req);
    if (!instanceId) {
      const issues: ZodIssue[] = [
        {
          code: z.ZodIssueCode.custom,
          path: ['params', 'id'],
          message: INVALID_INSTANCE_ID_MESSAGE,
        },
      ];
      respondWithValidationError(res, issues);
      return;
    }

    if (looksLikeWhatsAppJid(instanceId)) {
      const issues: ZodIssue[] = [
        {
          code: z.ZodIssueCode.custom,
          path: ['params', 'id'],
          message: 'Para desconectar um JID use a rota de disconnect.',
        },
      ];
      respondWithValidationError(res, issues);
      return;
    }

    const tenantId = resolveRequestTenantId(req);
    const actorId = resolveRequestActorId(req);

    const stored = await prisma.whatsAppInstance.findFirst({
      where: {
        tenantId,
        id: instanceId,
      },
    });

    if (!stored) {
      res.status(404).json({
        success: false,
        error: {
          code: 'INSTANCE_NOT_FOUND',
          message: 'Instância não localizada para o tenant informado.',
        },
      });
      return;
    }

    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
    const wipeValue =
      normalizeBooleanValue(req.query.wipe) ??
      normalizeBooleanValue(body.wipe);
    const wipe = wipeValue === true;

    let brokerStatus: 'deleted' | 'not_found' = 'deleted';

    try {
      try {
        whatsappHttpRequestsCounter?.inc?.();
      } catch {
        // metrics optional
      }

      const deleteOptions: DeleteInstanceOptions = wipeValue === null
        ? { instanceId: stored.id }
        : { instanceId: stored.id, wipe };

      await whatsappBrokerClient.deleteInstance(stored.brokerId, deleteOptions);
      logger.info('whatsapp.instances.delete.broker', {
        tenantId,
        instanceId: stored.id,
        brokerId: stored.brokerId,
        wipe,
      });
    } catch (error: unknown) {
      if (error instanceof WhatsAppBrokerNotConfiguredError) {
        if (handleWhatsAppIntegrationError(res, error)) {
          return;
        }
      }

      if (isBrokerMissingInstanceError(error)) {
        brokerStatus = 'not_found';
        logger.warn('whatsapp.instances.delete.brokerMissing', {
          tenantId,
          instanceId: stored.id,
          brokerId: stored.brokerId,
          error: describeErrorForLog(error),
        });
      } else {
        logger.error('whatsapp.instances.delete.brokerFailed', {
          tenantId,
          instanceId: stored.id,
          brokerId: stored.brokerId,
          error: describeErrorForLog(error),
        });

        res.status(502).json({
          success: false,
          error: {
            code: 'WHATSAPP_BROKER_DELETE_FAILED',
            message: 'Falha ao remover instância junto ao broker WhatsApp.',
            details: describeErrorForLog(error),
          },
        });
        return;
      }
    }

    try {
      const result = await deleteStoredInstance(tenantId, stored, actorId);
      emitToTenant(tenantId, 'whatsapp.instances.deleted', {
        id: stored.id,
        tenantId,
        deletedAt: result.deletedAt,
        brokerStatus,
      });

      res.status(200).json({
        success: true,
        data: {
          id: stored.id,
          brokerStatus,
          deletedAt: result.deletedAt,
          instances: result.instances,
        },
      });
    } catch (error: unknown) {
      if (handleWhatsAppIntegrationError(res, error)) {
        return;
      }

      logger.error('whatsapp.instances.delete.failed', {
        tenantId,
        instanceId: stored.id,
        brokerId: stored.brokerId,
        error: describeErrorForLog(error),
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INSTANCE_DELETE_FAILED',
          message: 'Falha ao remover instância WhatsApp.',
        },
      });
    }
  })
);