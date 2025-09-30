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
  qr?: {
    content?: string;
    expiresAt?: string;
  } | null;
  qrCode?: string;
  qrExpiresAt?: string;
  rate?: unknown;
  user?: unknown;
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

  const qrSource = (() => {
    if (status?.qr && typeof status.qr === 'object') {
      return status.qr as Record<string, unknown>;
    }
    return null;
  })();

  const qrCode = (() => {
    if (qrSource) {
      const content = qrSource.content;
      if (typeof content === 'string' && content.trim().length > 0) {
        return content;
      }
    }
    if (typeof status?.qrCode === 'string' && status.qrCode.trim().length > 0) {
      return status.qrCode.trim();
    }
    return null;
  })();

  const qrExpiresAt = (() => {
    if (qrSource && typeof qrSource.expiresAt === 'string') {
      return qrSource.expiresAt;
    }
    if (typeof status?.qrExpiresAt === 'string') {
      return status.qrExpiresAt;
    }
    return null;
  })();

  return {
    status: normalizedStatus,
    connected,
    qrCode,
    qrExpiresAt,
    rate: parseRateLimit(status?.rate ?? null),
  };
};

const resolveTenantSessionId = (tenantId: string): string => tenantId;

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
        id?: string;
        status?: string;
        rate?: unknown;
        ack?: Record<string, unknown>;
      }>({
        instanceId: sessionId,
        to,
        text: message,
        previewUrl,
        externalId,
      });

      const ackRecord =
        result?.ack && typeof result.ack === 'object' ? (result.ack as Record<string, unknown>) : undefined;

      const normalizedExternalId = (() => {
        const ackId = typeof ackRecord?.id === 'string' && ackRecord.id.trim().length > 0 ? ackRecord.id.trim() : null;
        if (ackId) {
          return ackId;
        }
        if (typeof result?.externalId === 'string' && result.externalId.trim().length > 0) {
          return result.externalId.trim();
        }
        if (typeof result?.id === 'string' && result.id.trim().length > 0) {
          return result.id.trim();
        }
        if (typeof externalId === 'string' && externalId.trim().length > 0) {
          return externalId.trim();
        }
        return null;
      })();

      const normalizedStatus = (() => {
        const ackStatus = typeof ackRecord?.status === 'string' ? ackRecord.status : undefined;
        if (ackStatus) {
          return ackStatus;
        }
        if (typeof result?.status === 'string' && result.status.trim().length > 0) {
          return result.status.trim();
        }
        return 'queued';
      })();

      res.status(202).json({
        success: true,
        data: {
          externalId: normalizedExternalId,
          status: normalizedStatus,
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
        instanceId: sessionId,
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
        nextCursor?: string | null;
        rate?: BrokerRateLimit | Record<string, unknown> | null;
      }>({
        limit,
        cursor,
      });

      res.json({
        success: true,
        data: {
          items: Array.isArray(events?.events) ? events.events : [],
          nextCursor: typeof events?.nextCursor === 'string' ? events.nextCursor : null,
          pending: typeof events?.pending === 'number' ? events.pending : null,
          ack: events?.ack ?? null,
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
      await whatsappBrokerClient.ackEvents(eventIds);

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
