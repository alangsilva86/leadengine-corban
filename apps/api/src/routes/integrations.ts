import { Router, Request, Response } from 'express';
import { body, param, query } from 'express-validator';
import { asyncHandler } from '../middleware/error-handler';
import { requireTenant } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import {
  whatsappBrokerClient,
  WhatsAppBrokerNotConfiguredError,
} from '../services/whatsapp-broker-client';

const respondWhatsAppNotConfigured = (res: Response, error: unknown): boolean => {
  if (error instanceof WhatsAppBrokerNotConfiguredError) {
    res.status(503).json({
      success: false,
      error: {
        code: 'WHATSAPP_NOT_CONFIGURED',
        message: error.message,
      },
    });
    return true;
  }

  return false;
};

const resolveDefaultInstanceId = (): string =>
  (process.env.LEADENGINE_INSTANCE_ID || '').trim() || 'leadengine';

const router: Router = Router();

// ============================================================================
// WhatsApp Routes
// ============================================================================

type BrokerRateLimit = {
  limit: number | null;
  remaining: number | null;
  resetAt: string | null;
};

type BrokerSessionStatus = {
  status?: string;
  connected?: boolean;
  qrCode?: string;
  qrExpiresAt?: string;
  rate?: unknown;
};

type BrokerInstance = {
  id?: string;
  tenantId?: string;
  name?: string;
  status?: string;
  connected?: boolean;
  createdAt?: string;
  lastActivity?: string | null;
  phoneNumber?: string | null;
  user?: string | null;
  stats?: unknown;
};

type NormalizedInstance = {
  id: string;
  tenantId: string | null;
  name: string | null;
  status: 'connected' | 'connecting' | 'disconnected' | 'qr_required';
  connected: boolean;
  createdAt: string | null;
  lastActivity: string | null;
  phoneNumber: string | null;
  user: string | null;
  stats?: unknown;
};

const normalizeInstanceStatus = (
  status: unknown,
  connectedValue?: unknown
): { status: NormalizedInstance['status']; connected: boolean } => {
  const rawStatus = typeof status === 'string' ? status.toLowerCase() : undefined;
  const connected = Boolean(connectedValue ?? (rawStatus === 'connected'));

  const normalizedStatus: NormalizedInstance['status'] = (() => {
    switch (rawStatus) {
      case 'connected':
      case 'connecting':
      case 'qr_required':
      case 'disconnected':
        return rawStatus;
      default:
        return connected ? 'connected' : 'disconnected';
    }
  })();

  return { status: normalizedStatus, connected };
};

const normalizeInstance = (instance: unknown): NormalizedInstance | null => {
  if (!instance || typeof instance !== 'object') {
    return null;
  }

  const source = instance as BrokerInstance & Record<string, unknown>;

  const idCandidate = [source.id, source.instanceId, source.sessionId]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .find((value) => value.length > 0);

  if (!idCandidate) {
    return null;
  }

  const { status, connected } = normalizeInstanceStatus(source.status, source.connected);

  return {
    id: idCandidate,
    tenantId: typeof source.tenantId === 'string' ? source.tenantId : null,
    name: typeof source.name === 'string' ? source.name : null,
    status,
    connected,
    createdAt: typeof source.createdAt === 'string' ? source.createdAt : null,
    lastActivity:
      typeof source.lastActivity === 'string' || source.lastActivity === null
        ? (source.lastActivity as string | null)
        : null,
    phoneNumber:
      typeof source.phoneNumber === 'string' ? source.phoneNumber : null,
    user: typeof source.user === 'string' ? source.user : null,
    stats: typeof source.stats === 'object' && source.stats !== null ? source.stats : undefined,
  };
};

const normalizeQrCode = (
  value: unknown
): { qrCode: string | null; expiresAt: string | null } => {
  if (!value || typeof value !== 'object') {
    return { qrCode: null, expiresAt: null };
  }

  const source = value as Record<string, unknown>;

  return {
    qrCode: typeof source.qrCode === 'string' ? source.qrCode : null,
    expiresAt: typeof source.expiresAt === 'string' ? source.expiresAt : null,
  };
};

const normalizeInstanceStatusResponse = (
  status: unknown
): { status: NormalizedInstance['status']; connected: boolean } => {
  if (!status || typeof status !== 'object') {
    return normalizeInstanceStatus(undefined, undefined);
  }

  const source = status as Record<string, unknown>;
  return normalizeInstanceStatus(source.status, source.connected);
};

const parseNumber = (input: unknown): number | null => {
  if (typeof input === 'number' && Number.isFinite(input)) {
    return input;
  }

  if (typeof input === 'string' && input.trim().length > 0) {
    const parsed = Number(input);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const parseRateLimit = (value: unknown): BrokerRateLimit | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const source = value as Record<string, unknown>;
  const limit = parseNumber(source.limit);
  const remaining = parseNumber(source.remaining);
  const resetCandidate = source.resetAt ?? source.reset ?? source.reset_at;
  let resetAt: string | null = null;

  if (typeof resetCandidate === 'string') {
    resetAt = resetCandidate;
  } else {
    const parsed = parseNumber(resetCandidate);
    resetAt = parsed !== null ? new Date(parsed).toISOString() : null;
  }

  if (limit === null && remaining === null && resetAt === null) {
    return null;
  }

  return { limit, remaining, resetAt };
};

const normalizeSessionStatus = (status: BrokerSessionStatus | null | undefined) => {
  const rawStatus = typeof status?.status === 'string' ? status.status.toLowerCase() : undefined;
  const connected = Boolean(status?.connected ?? (rawStatus === 'connected'));
  const normalizedStatus = ((): 'connected' | 'connecting' | 'disconnected' | 'qr_required' => {
    switch (rawStatus) {
      case 'connected':
      case 'connecting':
      case 'qr_required':
      case 'disconnected':
        return rawStatus;
      default:
        return connected ? 'connected' : 'disconnected';
    }
  })();

  return {
    status: normalizedStatus,
    connected,
    qrCode: typeof status?.qrCode === 'string' ? status.qrCode : null,
    qrExpiresAt: typeof status?.qrExpiresAt === 'string' ? status.qrExpiresAt : null,
    rate: parseRateLimit(status?.rate ?? null),
  };
};

const resolveTenantSessionId = (tenantId: string): string => tenantId;

// GET /api/integrations/whatsapp/instances - List WhatsApp instances
router.get(
  '/whatsapp/instances',
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.tenantId;

    try {
      const instances = await whatsappBrokerClient.listInstances(tenantId);
      const normalized = instances
        .map((instance) => normalizeInstance(instance))
        .filter((instance): instance is NormalizedInstance => instance !== null);

      res.json({
        success: true,
        data: normalized,
      });
    } catch (error) {
      if (respondWhatsAppNotConfigured(res, error)) {
        return;
      }
      throw error;
    }
  })
);

// POST /api/integrations/whatsapp/instances - Create a WhatsApp instance
router.post(
  '/whatsapp/instances',
  body('name').isString().isLength({ min: 1 }),
  body('webhookUrl').optional().isURL(),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.tenantId;
    const { name, webhookUrl } = req.body as { name: string; webhookUrl?: string };

    try {
      const instance = await whatsappBrokerClient.createInstance({
        tenantId,
        name,
        webhookUrl,
      });

      const normalized = normalizeInstance(instance);

      res.status(201).json({
        success: true,
        data: normalized,
      });
    } catch (error) {
      if (respondWhatsAppNotConfigured(res, error)) {
        return;
      }
      throw error;
    }
  })
);

// POST /api/integrations/whatsapp/instances/:id/start - Connect a WhatsApp instance
router.post(
  '/whatsapp/instances/:id/start',
  param('id').isString().isLength({ min: 1 }),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const instanceId = req.params.id;

    try {
      await whatsappBrokerClient.connectInstance(instanceId);
      const status = await whatsappBrokerClient.getStatus(instanceId);

      res.json({
        success: true,
        data: normalizeInstanceStatusResponse(status),
      });
    } catch (error) {
      if (respondWhatsAppNotConfigured(res, error)) {
        return;
      }
      throw error;
    }
  })
);

// POST /api/integrations/whatsapp/instances/connect - Connect the default WhatsApp instance
router.post(
  '/whatsapp/instances/connect',
  requireTenant,
  asyncHandler(async (_req: Request, res: Response) => {
    const instanceId = resolveDefaultInstanceId();

    try {
      await whatsappBrokerClient.connectInstance(instanceId);
      const status = await whatsappBrokerClient.getStatus(instanceId);

      res.json({
        success: true,
        data: normalizeInstanceStatusResponse(status),
      });
    } catch (error) {
      if (respondWhatsAppNotConfigured(res, error)) {
        return;
      }
      throw error;
    }
  })
);

// POST /api/integrations/whatsapp/instances/:id/stop - Disconnect a WhatsApp instance
router.post(
  '/whatsapp/instances/:id/stop',
  param('id').isString().isLength({ min: 1 }),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const instanceId = req.params.id;

    try {
      await whatsappBrokerClient.disconnectInstance(instanceId);
      const status = await whatsappBrokerClient.getStatus(instanceId);

      res.json({
        success: true,
        data: normalizeInstanceStatusResponse(status),
      });
    } catch (error) {
      if (respondWhatsAppNotConfigured(res, error)) {
        return;
      }
      throw error;
    }
  })
);

// POST /api/integrations/whatsapp/instances/disconnect - Disconnect the default WhatsApp instance
router.post(
  '/whatsapp/instances/disconnect',
  requireTenant,
  asyncHandler(async (_req: Request, res: Response) => {
    const instanceId = resolveDefaultInstanceId();

    try {
      await whatsappBrokerClient.disconnectInstance(instanceId);
      const status = await whatsappBrokerClient.getStatus(instanceId);

      res.json({
        success: true,
        data: normalizeInstanceStatusResponse(status),
      });
    } catch (error) {
      if (respondWhatsAppNotConfigured(res, error)) {
        return;
      }
      throw error;
    }
  })
);

// GET /api/integrations/whatsapp/instances/:id/qr - Fetch QR code for a WhatsApp instance
router.get(
  '/whatsapp/instances/:id/qr',
  param('id').isString().isLength({ min: 1 }),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const instanceId = req.params.id;

    try {
      const qrCode = await whatsappBrokerClient.getQrCode(instanceId);

      res.json({
        success: true,
        data: normalizeQrCode(qrCode),
      });
    } catch (error) {
      if (respondWhatsAppNotConfigured(res, error)) {
        return;
      }
      throw error;
    }
  })
);

// GET /api/integrations/whatsapp/instances/qr - Fetch QR code for the default WhatsApp instance
router.get(
  '/whatsapp/instances/qr',
  requireTenant,
  asyncHandler(async (_req: Request, res: Response) => {
    const instanceId = resolveDefaultInstanceId();

    try {
      const qrCode = await whatsappBrokerClient.getQrCode(instanceId);

      res.json({
        success: true,
        data: normalizeQrCode(qrCode),
      });
    } catch (error) {
      if (respondWhatsAppNotConfigured(res, error)) {
        return;
      }
      throw error;
    }
  })
);

// GET /api/integrations/whatsapp/instances/:id/status - Retrieve instance status
router.get(
  '/whatsapp/instances/:id/status',
  param('id').isString().isLength({ min: 1 }),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const instanceId = req.params.id;

    try {
      const status = await whatsappBrokerClient.getStatus(instanceId);

      res.json({
        success: true,
        data: normalizeInstanceStatusResponse(status),
      });
    } catch (error) {
      if (respondWhatsAppNotConfigured(res, error)) {
        return;
      }
      throw error;
    }
  })
);

// POST /api/integrations/whatsapp/session/connect - Conectar sessão única
router.post(
  '/whatsapp/session/connect',
  body('webhookUrl').optional().isURL(),
  body('forceReopen').optional().isBoolean().toBoolean(),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.tenantId;
    const sessionId = resolveTenantSessionId(tenantId);
    const { webhookUrl, forceReopen } = req.body as {
      webhookUrl?: string;
      forceReopen?: boolean;
    };

    try {
      await whatsappBrokerClient.connectSession(sessionId, {
        webhookUrl,
        forceReopen,
      });
      const status = await whatsappBrokerClient.getSessionStatus<BrokerSessionStatus>(sessionId);

      res.json({
        success: true,
        data: normalizeSessionStatus(status),
      });
    } catch (error) {
      if (respondWhatsAppNotConfigured(res, error)) {
        return;
      }
      throw error;
    }
  })
);

// POST /api/integrations/whatsapp/session/logout - Desconectar sessão
router.post(
  '/whatsapp/session/logout',
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.tenantId;
    const sessionId = resolveTenantSessionId(tenantId);

    try {
      await whatsappBrokerClient.logoutSession(sessionId);
      const status = await whatsappBrokerClient.getSessionStatus<BrokerSessionStatus>(sessionId);

      res.json({
        success: true,
        data: normalizeSessionStatus(status),
      });
    } catch (error) {
      if (respondWhatsAppNotConfigured(res, error)) {
        return;
      }
      throw error;
    }
  })
);

// GET /api/integrations/whatsapp/session/status - Status da sessão única
router.get(
  '/whatsapp/session/status',
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.tenantId;
    const sessionId = resolveTenantSessionId(tenantId);

    try {
      const status = await whatsappBrokerClient.getSessionStatus<BrokerSessionStatus>(sessionId);

      res.json({
        success: true,
        data: normalizeSessionStatus(status),
      });
    } catch (error) {
      if (respondWhatsAppNotConfigured(res, error)) {
        return;
      }
      throw error;
    }
  })
);

// POST /api/integrations/whatsapp/messages - Enviar mensagem de texto
router.post(
  '/whatsapp/messages',
  body('to').isString().isLength({ min: 1 }),
  body('message').isString().isLength({ min: 1 }),
  body('previewUrl').optional().isBoolean().toBoolean(),
  body('externalId').optional().isString().isLength({ min: 1 }),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.tenantId;
    const sessionId = resolveTenantSessionId(tenantId);
    const { to, message, previewUrl, externalId } = req.body as {
      to: string;
      message: string;
      previewUrl?: boolean;
      externalId?: string;
    };

    try {
      const result = await whatsappBrokerClient.sendText<{
        externalId?: string;
        status?: string;
        rate?: unknown;
      }>({
        sessionId,
        to,
        message,
        previewUrl,
        externalId,
      });

      res.status(202).json({
        success: true,
        data: {
          externalId: typeof result?.externalId === 'string' ? result.externalId : null,
          status: typeof result?.status === 'string' ? result.status : 'queued',
          rate: parseRateLimit(result?.rate ?? null),
        },
      });
    } catch (error) {
      if (respondWhatsAppNotConfigured(res, error)) {
        return;
      }
      throw error;
    }
  })
);

// POST /api/integrations/whatsapp/polls - Criar enquete
router.post(
  '/whatsapp/polls',
  body('to').isString().isLength({ min: 1 }),
  body('question').isString().isLength({ min: 1 }),
  body('options').isArray({ min: 2 }),
  body('options.*').isString().isLength({ min: 1 }),
  body('allowMultipleAnswers').optional().isBoolean().toBoolean(),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.tenantId;
    const sessionId = resolveTenantSessionId(tenantId);
    const { to, question, options, allowMultipleAnswers } = req.body as {
      to: string;
      question: string;
      options: string[];
      allowMultipleAnswers?: boolean;
    };

    try {
      const poll = await whatsappBrokerClient.createPoll<{ rate?: unknown } & Record<string, unknown>>({
        sessionId,
        to,
        question,
        options,
        allowMultipleAnswers,
      });

      res.status(201).json({
        success: true,
        data: {
          poll,
          rate: parseRateLimit(poll?.rate ?? null),
        },
      });
    } catch (error) {
      if (respondWhatsAppNotConfigured(res, error)) {
        return;
      }
      throw error;
    }
  })
);

// GET /api/integrations/whatsapp/events - Listar eventos pendentes
router.get(
  '/whatsapp/events',
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('cursor').optional().isString(),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const { limit, cursor } = req.query as { limit?: number; cursor?: string };

    try {
      const events = await whatsappBrokerClient.fetchEvents<{
        events?: unknown[];
        items?: unknown[];
        nextCursor?: string | null;
        nextId?: string | null;
        rate?: BrokerRateLimit | Record<string, unknown> | null;
      }>({
        limit,
        cursor,
      });

      const items = Array.isArray(events?.items)
        ? events.items
        : Array.isArray(events?.events)
          ? events.events
          : [];

      const nextCursorValue =
        typeof events?.nextCursor === 'string' && events.nextCursor.trim().length > 0
          ? events.nextCursor.trim()
          : typeof events?.nextId === 'string' && events.nextId.trim().length > 0
            ? events.nextId.trim()
            : null;

      res.json({
        success: true,
        data: {
          items,
          nextCursor: nextCursorValue,
          rate: parseRateLimit(events?.rate ?? null),
        },
      });
    } catch (error) {
      if (respondWhatsAppNotConfigured(res, error)) {
        return;
      }
      throw error;
    }
  })
);

// POST /api/integrations/whatsapp/events/ack - Confirmar processamento de eventos
router.post(
  '/whatsapp/events/ack',
  body('eventIds').isArray({ min: 1 }),
  body('eventIds.*').isString().isLength({ min: 1 }),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const { eventIds } = req.body as { eventIds: string[] };

    try {
      await whatsappBrokerClient.ackEvents({ ids: eventIds });

      res.json({
        success: true,
      });
    } catch (error) {
      if (respondWhatsAppNotConfigured(res, error)) {
        return;
      }
      throw error;
    }
  })
);

// ============================================================================
// URA/Telephony Routes
// ============================================================================

// GET /api/integrations/ura/flows - Listar fluxos URA
router.get(
  '/ura/flows',
  requireTenant,
  asyncHandler(async (_req: Request, res: Response) => {
    // TODO: Implementar URAProvider.getFlows()
    const flows = [
      {
        id: 'flow-1',
        name: 'Atendimento Principal',
        isActive: true,
        steps: []
      }
    ];

    res.json({
      success: true,
      data: flows
    });
  })
);

// POST /api/integrations/ura/flows - Criar fluxo URA
router.post(
  '/ura/flows',
  body('name').isString().isLength({ min: 1, max: 100 }),
  body('steps').isArray(),
  body('isActive').optional().isBoolean(),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const { name, steps, isActive = true } = req.body as {
      name: string;
      steps: unknown[];
      isActive?: boolean;
    };

    // TODO: Implementar URAProvider.createFlow()
    const flow = {
      id: `flow-${Date.now()}`,
      name,
      steps,
      isActive
    };

    res.status(201).json({
      success: true,
      data: flow
    });
  })
);

// POST /api/integrations/ura/calls - Fazer chamada
router.post(
  '/ura/calls',
  body('to').isString(),
  body('flowId').optional().isString(),
  body('variables').optional().isObject(),
  body('scheduledAt').optional().isISO8601(),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const { to, flowId, variables, scheduledAt } = req.body as {
      to: string;
      flowId?: string;
      variables?: Record<string, unknown>;
      scheduledAt?: string;
    };

    // TODO: Implementar URAProvider.makeCall()
    const call = {
      id: `call-${Date.now()}`,
      from: '+5511999999999',
      to,
      status: 'ringing',
      startTime: new Date(),
      flowId: flowId ?? null,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      metadata: variables ?? null,
    };

    res.status(201).json({
      success: true,
      data: call
    });
  })
);

// GET /api/integrations/ura/calls/:id - Obter informações da chamada
router.get(
  '/ura/calls/:id',
  param('id').isString(),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const callId = req.params.id;

    // TODO: Implementar URAProvider.getCall()
    const call = {
      id: callId,
      from: '+5511999999999',
      to: '+5511888888888',
      status: 'completed',
      startTime: new Date(Date.now() - 300000),
      endTime: new Date(),
      duration: 300,
      recording: 'https://example.com/recording.mp3'
    };

    res.json({
      success: true,
      data: call
    });
  })
);

// POST /api/integrations/ura/calls/:id/hangup - Desligar chamada
router.post(
  '/ura/calls/:id/hangup',
  param('id').isString(),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const callId = req.params.id;

    // TODO: Implementar URAProvider.hangupCall()
    res.json({
      success: true,
      message: 'Call ended successfully',
      callId,
    });
  })
);

// POST /api/integrations/ura/calls/:id/transfer - Transferir chamada
router.post(
  '/ura/calls/:id/transfer',
  param('id').isString(),
  body('to').isString(),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const callId = req.params.id;
    const { to } = req.body as { to: string };

    // TODO: Implementar URAProvider.transferCall()
    res.json({
      success: true,
      message: 'Call transferred successfully',
      callId,
      to,
    });
  })
);

// GET /api/integrations/ura/statistics - Estatísticas de chamadas
router.get(
  '/ura/statistics',
  query('startDate').isISO8601(),
  query('endDate').isISO8601(),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const startDate = new Date(req.query.startDate as string);
    const endDate = new Date(req.query.endDate as string);

    // TODO: Implementar URAProvider.getCallStatistics()
    const statistics = {
      totalCalls: 150,
      answeredCalls: 120,
      failedCalls: 30,
      averageDuration: 180,
      answerRate: 0.8
    };

    res.json({
      success: true,
      data: {
        ...statistics,
        range: {
          startDate,
          endDate,
        },
      },
    });
  })
);

// ============================================================================
// Health Check Routes
// ============================================================================

// GET /api/integrations/health - Health check das integrações
router.get(
  '/health',
  asyncHandler(async (_req: Request, res: Response) => {
    // TODO: Implementar health checks reais
    const health = {
      whatsapp: {
        status: 'healthy',
        instances: 2,
        connectedInstances: 1
      },
      ura: {
        status: 'healthy',
        activeCalls: 0
      },
      timestamp: new Date()
    };

    res.json({
      success: true,
      data: health
    });
  })
);

export { router as integrationsRouter };
