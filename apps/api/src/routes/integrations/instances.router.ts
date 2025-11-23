
import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../middleware/error-handler';
import { requireTenant } from '../../middleware/auth';
import { validateRequest } from '../../middleware/validation';
import {
  whatsappBrokerClient,
  WhatsAppBrokerNotConfiguredError,
  WhatsAppBrokerError,
  type WhatsAppStatus,
  type WhatsAppBrokerInstanceSnapshot,
  type DeleteInstanceOptions,
} from '../../services/whatsapp-broker-client';
import { emitToTenant } from '../../lib/socket-registry';
import { prisma } from '../../lib/prisma';
import { logger } from '../../config/logger';
import { respondWithValidationError } from '../../utils/http-validation';
import { normalizePhoneNumber, PhoneNormalizationError } from '../../utils/phone';
import { whatsappHttpRequestsCounter } from '../../lib/metrics';
import { getWhatsAppTransport } from '../../features/whatsapp-transport';
import { z, type ZodIssue } from 'zod';
import {
  normalizeBooleanValue,
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
  buildInstanceStatusPayload,
  fetchStatusWithBrokerQr,
  normalizeInstanceStatusResponse,
  extractQrImageBuffer,
  disconnectStoredInstance,
  deleteStoredInstance,
  resolveInstanceOperationContext,
  serializeStoredInstance,
  normalizeStatusCountsData,
  normalizeRateUsageData,
  collectNumericFromSources,
  syncInstancesFromBroker,
  archiveInstanceSnapshot,
  archiveDetachedInstance,
  scheduleWhatsAppDisconnectRetry,
  clearWhatsAppDisconnectRetry,
  removeCachedSnapshot,
  clearInstanceArchive,
  collectInstancesForTenant,
} from '../../modules/whatsapp/instances';
import { parseListInstancesQuery, listInstancesUseCase } from '../../modules/whatsapp/instances/list-instances';
import type { InstanceOperationContext, StoredInstance } from '../../modules/whatsapp/instances';
import { resolveRequestTenantId, resolveRequestActorId } from '../../services/tenant-service';
import { normalizeQueryValue, resolveRequestId } from '../../utils/request-parsers';


export class WhatsAppInstancesService {
  createWhatsAppInstance = createWhatsAppInstance;
  executeSideEffects = executeSideEffects;
  fetchStatusWithBrokerQr = fetchStatusWithBrokerQr;
  buildInstanceStatusPayload = buildInstanceStatusPayload;
  normalizeInstanceStatusResponse = normalizeInstanceStatusResponse;
  resolveInstanceOperationContext = resolveInstanceOperationContext;
  disconnectStoredInstance = disconnectStoredInstance;
  deleteStoredInstance = deleteStoredInstance;
  serializeStoredInstance = serializeStoredInstance;
  normalizeStatusCountsData = normalizeStatusCountsData;
  normalizeRateUsageData = normalizeRateUsageData;
  collectNumericFromSources = collectNumericFromSources;
  syncInstancesFromBroker = syncInstancesFromBroker;
  archiveInstanceSnapshot = archiveInstanceSnapshot;
  archiveDetachedInstance = archiveDetachedInstance;
  scheduleWhatsAppDisconnectRetry = scheduleWhatsAppDisconnectRetry;
  clearWhatsAppDisconnectRetry = clearWhatsAppDisconnectRetry;
  removeCachedSnapshot = removeCachedSnapshot;
  clearInstanceArchive = clearInstanceArchive;
  collectInstancesForTenant = collectInstancesForTenant;
  parseListInstancesQuery = parseListInstancesQuery;
  listInstancesUseCase = listInstancesUseCase;
}

export class IntegrationsController {
  constructor(public readonly instancesService: WhatsAppInstancesService) {}
}

const controller = new IntegrationsController(new WhatsAppInstancesService());

const {
  createWhatsAppInstance: createInstance,
  executeSideEffects: executeInstanceSideEffects,
  fetchStatusWithBrokerQr: fetchStatusWithBrokerQrUseCase,
  buildInstanceStatusPayload: buildInstanceStatusPayloadUseCase,
  normalizeInstanceStatusResponse: normalizeInstanceStatusResponseUseCase,
  resolveInstanceOperationContext: resolveInstanceOperationContextUseCase,
  disconnectStoredInstance: disconnectStoredInstanceUseCase,
  deleteStoredInstance: deleteStoredInstanceUseCase,
  serializeStoredInstance: serializeStoredInstanceUseCase,
  normalizeStatusCountsData: normalizeStatusCountsDataUseCase,
  normalizeRateUsageData: normalizeRateUsageDataUseCase,
  collectNumericFromSources: collectNumericFromSourcesUseCase,
  syncInstancesFromBroker: syncInstancesFromBrokerUseCase,
  archiveInstanceSnapshot: archiveInstanceSnapshotUseCase,
  archiveDetachedInstance: archiveDetachedInstanceUseCase,
  scheduleWhatsAppDisconnectRetry: scheduleWhatsAppDisconnectRetryUseCase,
  clearWhatsAppDisconnectRetry: clearWhatsAppDisconnectRetryUseCase,
  removeCachedSnapshot: removeCachedSnapshotUseCase,
  clearInstanceArchive: clearInstanceArchiveUseCase,
  collectInstancesForTenant: collectInstancesForTenantUseCase,
  parseListInstancesQuery: parseListInstancesQueryHandler,
  listInstancesUseCase: listInstancesUseCaseHandler,
} = controller.instancesService;


const router: Router = Router();

type QrResponseFormat = 'json' | 'png';

type QrResponseOptions = {
  req: Request;
  res: Response;
  format: QrResponseFormat;
  logPrefix: string;
  instanceId?: string | null;
  notFoundMessage?: string;
  includeInstanceIdInPayload?: boolean;
};

const buildQrResponse = async ({
  req,
  res,
  format,
  logPrefix,
  instanceId: providedInstanceId,
  notFoundMessage,
  includeInstanceIdInPayload,
}: QrResponseOptions): Promise<void> => {
  const instanceId = providedInstanceId ?? readInstanceIdParam(req);
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

  logger.info(`${logPrefix}.request`, {
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
    if (
      respondWhatsAppStorageUnavailable(res, error, {
        tenantId,
        instanceId,
        operation: `${logPrefix}.lookup`,
        operationType: 'qr.read',
      })
    ) {
      return;
    }
    throw error;
  }

  if (!stored) {
    logger.warn(`${logPrefix}.notFound`, {
      tenantId,
      instanceId,
    });

    if (format === 'json') {
      res.status(404).json({
        success: false,
        error: {
          code: 'INSTANCE_NOT_FOUND',
          message: notFoundMessage ?? 'Instância não localizada para o tenant informado.',
        },
      });
    } else {
      res.sendStatus(404);
    }
    return;
  }

  try {
    const { context, qr } = await fetchStatusWithBrokerQrUseCase(tenantId, stored, {
      refresh,
      fetchSnapshots,
    });

    if (format === 'png') {
      const buffer = extractQrImageBuffer(qr);
      if (!buffer) {
        logger.warn(`${logPrefix}.empty`, {
          tenantId,
          instanceId,
          refresh,
          fetchSnapshots,
        });
        res.sendStatus(404);
        return;
      }

      const durationMs = Date.now() - startedAt;

      logger.info(`${logPrefix}.success`, {
        tenantId,
        instanceId,
        refresh,
        fetchSnapshots,
        connected: context.status.connected,
        durationMs,
      });

      res.setHeader('content-type', 'image/png');
      res.status(200).send(buffer);
      return;
    }

    const payload = buildInstanceStatusPayloadUseCase(context, qr);
    const durationMs = Date.now() - startedAt;
    const data = includeInstanceIdInPayload
      ? { ...payload, instanceId: payload.instance.id }
      : payload;

    if (!qr.available) {
      logger.warn(`${logPrefix}.empty`, {
        tenantId,
        instanceId,
        refresh,
        fetchSnapshots,
        reason: qr.reason ?? 'UNAVAILABLE',
      });
      res.status(200).json({
        success: true,
        data,
        meta: {
          tenantId,
          instanceId: payload.instance.id,
          refresh,
          fetchSnapshots,
          durationMs,
          qrAvailable: qr.available,
          qrReason: qr.reason,
        },
      });
      return;
    }

    logger.info(`${logPrefix}.success`, {
      tenantId,
      instanceId,
      refresh,
      fetchSnapshots,
      connected: payload.connected,
      durationMs,
    });

    res.status(200).json({
      success: true,
      data,
      meta: {
        tenantId,
        instanceId: payload.instance.id,
        refresh,
        fetchSnapshots,
        durationMs,
        qrAvailable: payload.qr.available,
        qrReason: payload.qr.reason,
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
        logger.warn(`${logPrefix}.brokerNotReady`, {
          tenantId,
          instanceId,
          refresh,
          fetchSnapshots,
          status,
        });

        if (format === 'json') {
          const fallbackPayload = context ? buildInstanceStatusPayloadUseCase(context) : null;
          res.status(200).json({
            success: true,
            data: fallbackPayload,
            meta: {
              tenantId,
              instanceId: context?.instance.id ?? instanceId,
              refresh,
              fetchSnapshots,
              durationMs: Date.now() - startedAt,
              qrAvailable: false,
              qrReason: 'UNAVAILABLE',
            },
          });
        } else {
          res.sendStatus(404);
        }
        return;
      }

      logger.error(`${logPrefix}.brokerFailed`, {
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
    } else if (
      respondWhatsAppStorageUnavailable(res, error, {
        tenantId,
        instanceId: context?.instance.id ?? instanceId,
        operation: logPrefix,
        operationType: 'qr.read',
      })
    ) {
      return;
    }

    const durationMs = Date.now() - startedAt;

    logger.error(`${logPrefix}.failed`, {
      tenantId,
      instanceId,
      refresh,
      fetchSnapshots,
      durationMs,
      error: describeErrorForLog(error),
    });

    if (format === 'json') {
      res.status(500).json({
        success: false,
        error: {
          code: 'INSTANCE_QR_FAILED',
          message: 'Falha ao recuperar QR Code da instância WhatsApp.',
        },
        ...(context
          ? {
              data: buildInstanceStatusPayloadUseCase(context),
            }
          : {}),
      });
    } else {
      res.sendStatus(500);
    }
  }
};

// POST /api/integrations/whatsapp/instances - Create WhatsApp instance
router.post(
  '/instances',
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const parsedBody = createWhatsAppInstanceSchema.safeParse(req.body ?? {});
    if (!parsedBody.success) {
      respondWithValidationError(res, parsedBody.error.issues);
      return;
    }

    const tenantId = resolveRequestTenantId(req, parsedBody.data.tenantId);
    const actorId = resolveRequestActorId(req);
    const requestId = resolveRequestId(req);

    logger.info('whatsapp.instances.create.request', {
      tenantId,
      actorId,
      name: parsedBody.data.name,
      instanceId: parsedBody.data.id ?? parsedBody.data.name ?? null,
      requestId,
    });

    try {
      const result = await createInstance({
        tenantId,
        actorId,
        input: parsedBody.data,
        requestId,
      });

      await executeInstanceSideEffects(result.sideEffects, {
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

      if (
        respondWhatsAppStorageUnavailable(res, error, {
          tenantId,
          instanceId: parsedBody.data.id ?? parsedBody.data.name ?? null,
          operation: 'instances.create',
          operationType: 'snapshot.write',
        })
      ) {
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
  const refreshToken = normalizeQueryValue(req.query.refresh);
  const normalizedRefresh = refreshToken?.toLowerCase() ?? null;
  const forced = normalizedRefresh === '1' || normalizedRefresh === 'true' || normalizedRefresh === 'yes';
  const mode = normalizeQueryValue(req.query.mode) ?? 'db';
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
  '/instances',
  requireTenant,
  rateLimitInstances as any,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = resolveRequestTenantId(req);
    const query = parseListInstancesQueryHandler(req.query);
    const requestId = resolveRequestId(req);

    try {
      const { payload, requestLog, responseLog } = await listInstancesUseCaseHandler({
        tenantId,
        query,
        requestId,
      });

      logger.info('whatsapp.instances.list.request', requestLog);
      logger.info('whatsapp.instances.list.response', responseLog);

      res.status(200).json(payload);
    } catch (error: unknown) {
      if (handleWhatsAppIntegrationError(res, error)) {
        return;
      }

      logger.error('whatsapp.instances.list.unexpected', {
        tenantId,
        requestId,
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
  '/instances/:id/status',
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
      if (
        respondWhatsAppStorageUnavailable(res, error, {
          tenantId,
          instanceId,
          operation: 'instances.status',
          operationType: 'snapshot.read',
        })
      ) {
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
      const context = await resolveInstanceOperationContextUseCase(tenantId, stored, {
        refresh,
        fetchSnapshots,
      });

      const payload = buildInstanceStatusPayloadUseCase(context);
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
          qrAvailable: payload.qr.available,
          qrReason: payload.qr.reason,
        },
      });
    } catch (error: unknown) {
      if (handleWhatsAppIntegrationError(res, error)) {
        return;
      }

      if (
        respondWhatsAppStorageUnavailable(res, error, {
          tenantId,
          instanceId,
          operation: 'instances.status',
          operationType: 'snapshot.read',
        })
      ) {
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
  '/instances/:id/qr',
  requireTenant,
  instanceIdParamValidator(),
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    await buildQrResponse({
      req,
      res,
      format: 'json',
      logPrefix: 'whatsapp.instances.qr',
    });
  })
);

router.get(
  '/instances/:id/qr.png',
  requireTenant,
  instanceIdParamValidator(),
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    await buildQrResponse({
      req,
      res,
      format: 'png',
      logPrefix: 'whatsapp.instances.qrImage',
    });
  })
);

router.get(
  '/instances/qr',
  requireTenant,
  asyncHandler(async (_req: Request, res: Response) => {
    respondLegacyEndpointGone(
      res,
      'Endpoint removido. Use /whatsapp/instances/:id/qr para recuperar o QR Code.',
    );
  })
);

router.get(
  '/instances/qr.png',
  requireTenant,
  asyncHandler(async (_req: Request, res: Response) => {
    respondLegacyEndpointGone(
      res,
      'Endpoint removido. Use /whatsapp/instances/:id/qr.png para recuperar a imagem do QR Code.',
    );
  })
);

router.post(
  '/instances/disconnect',
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

      const result = await disconnectStoredInstanceUseCase(tenantId, stored, actorId, disconnectOptions);

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
        await clearWhatsAppDisconnectRetryUseCase(tenantId, stored.id);
      } catch (error: unknown) {
        if (!logWhatsAppStorageError('disconnect.clearRetry', error, { tenantId, instanceId: stored.id })) {
          throw error;
        }
      }

      await removeCachedSnapshotUseCase(tenantId, stored.id, stored.brokerId);

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
  '/instances/:id/disconnect',
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
          await clearWhatsAppDisconnectRetryUseCase(tenantId, instanceId);
        } catch (error: unknown) {
          if (!logWhatsAppStorageError('disconnect.clearRetry', error, { tenantId, instanceId })) {
            throw error;
          }
        }

        await removeCachedSnapshotUseCase(tenantId, instanceId, instanceId);

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
            await scheduleWhatsAppDisconnectRetryUseCase(tenantId, {
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
        const deletedAt = await archiveDetachedInstanceUseCase(tenantId, instanceId, actorId);
        try {
          await removeCachedSnapshotUseCase(tenantId, instanceId, null);
        } catch (error) {
          logWhatsAppStorageError('disconnect.removeCachedSnapshot', error, {
            tenantId,
            instanceId,
          });
        }

        emitToTenant(tenantId, 'whatsapp.instances.deleted', {
          id: instanceId,
          tenantId,
          deletedAt,
          brokerStatus: 'not_found',
          existed: false,
        });

        res.status(200).json({
          success: true,
          data: {
            instanceId,
            disconnected: true,
            pending: false,
            existed: false,
            connected: null,
            status: null,
            qr: null,
            instance: null,
            instances: [],
            deletedAt,
          },
        });
        return;
      }

      const result = await disconnectStoredInstanceUseCase(tenantId, stored, actorId, disconnectOptions);

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
        await clearWhatsAppDisconnectRetryUseCase(tenantId, stored.id);
      } catch (error: unknown) {
        if (!logWhatsAppStorageError('disconnect.clearRetry', error, { tenantId, instanceId: stored.id })) {
          throw error;
        }
      }

      await removeCachedSnapshotUseCase(tenantId, stored.id, stored.brokerId);

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

export const whatsappInstancesRouter = router;

export const __testing = {
  serializeStoredInstance: serializeStoredInstanceUseCase,
  normalizeStatusCountsData: normalizeStatusCountsDataUseCase,
  normalizeRateUsageData: normalizeRateUsageDataUseCase,
  collectNumericFromSources: collectNumericFromSourcesUseCase,
  syncInstancesFromBroker: syncInstancesFromBrokerUseCase,
  collectInstancesForTenant: collectInstancesForTenantUseCase,
  listInstancesUseCase: listInstancesUseCaseHandler,
  parseListInstancesQuery: parseListInstancesQueryHandler,
  resolveInstanceOperationContext: resolveInstanceOperationContextUseCase,
  disconnectStoredInstance: disconnectStoredInstanceUseCase,
  deleteStoredInstance: deleteStoredInstanceUseCase,
  archiveInstanceSnapshot: archiveInstanceSnapshotUseCase,
  clearInstanceArchive: clearInstanceArchiveUseCase,
  clearWhatsAppDisconnectRetry: clearWhatsAppDisconnectRetryUseCase,
  removeCachedSnapshot: removeCachedSnapshotUseCase,
};

router.delete(
  '/instances/:id',
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

    const stored = await prisma.whatsAppInstance.findFirst({
      where: {
        tenantId,
        id: instanceId,
      },
    });

    const isBrokerSessionId = looksLikeWhatsAppJid(instanceId);

    if (!stored && !isBrokerSessionId) {
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

    const brokerId = stored?.brokerId ?? instanceId;

    try {
      try {
        whatsappHttpRequestsCounter?.inc?.();
      } catch {
        // metrics optional
      }

      const deleteOptions: DeleteInstanceOptions = wipeValue === null
        ? { instanceId: stored?.id ?? instanceId }
        : { instanceId: stored?.id ?? instanceId, wipe };

      await whatsappBrokerClient.deleteInstance(brokerId, deleteOptions);
      logger.info('whatsapp.instances.delete.broker', {
        tenantId,
        instanceId: stored?.id ?? instanceId,
        brokerId,
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
          instanceId: stored?.id ?? instanceId,
          brokerId,
          error: describeErrorForLog(error),
        });
      } else {
        logger.error('whatsapp.instances.delete.brokerFailed', {
          tenantId,
          instanceId: stored?.id ?? instanceId,
          brokerId,
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
      if (stored) {
        const result = await deleteStoredInstanceUseCase(tenantId, stored, actorId);
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
      } else {
        const deletedAt = await archiveDetachedInstanceUseCase(tenantId, instanceId, brokerId, actorId);
        try {
          await clearWhatsAppDisconnectRetryUseCase(tenantId, instanceId);
        } catch (error) {
          if (!logWhatsAppStorageError('deleteInstance.clearRetryDetached', error, { tenantId, instanceId, brokerId })) {
            throw error;
          }
        }

        try {
          await removeCachedSnapshotUseCase(tenantId, instanceId, brokerId);
        } catch (error) {
          if (!logWhatsAppStorageError('deleteInstance.removeCacheDetached', error, { tenantId, instanceId, brokerId })) {
            throw error;
          }
        }

        emitToTenant(tenantId, 'whatsapp.instances.deleted', {
          id: instanceId,
          tenantId,
          deletedAt,
          brokerStatus,
        });

        res.status(200).json({
          success: true,
          data: {
            id: instanceId,
            brokerStatus,
            deletedAt,
            instances: [],
          },
        });
      }
    } catch (error: unknown) {
      if (handleWhatsAppIntegrationError(res, error)) {
        return;
      }

      logger.error('whatsapp.instances.delete.failed', {
        tenantId,
        instanceId: stored?.id ?? instanceId,
        brokerId,
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
