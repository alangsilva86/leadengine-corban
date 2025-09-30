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

// GET /api/integrations/whatsapp/instances - Listar instâncias WhatsApp
router.get(
  '/whatsapp/instances',
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.tenantId;

    try {
      const instances = await whatsappBrokerClient.listInstances(tenantId);

      res.json({
        success: true,
        data: instances,
      });
    } catch (error) {
      if (respondWhatsAppNotConfigured(res, error)) {
        return;
      }
      throw error;
    }
  })
);

// POST /api/integrations/whatsapp/instances - Criar nova instância WhatsApp
router.post(
  '/whatsapp/instances',
  body('name').isString().isLength({ min: 1, max: 100 }),
  body('webhookUrl').optional().isURL(),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const { name, webhookUrl } = req.body as { name: string; webhookUrl?: string };
    const tenantId = req.user!.tenantId;

    try {
      const instance = await whatsappBrokerClient.createInstance({
        tenantId,
        name,
        webhookUrl,
      });

      res.status(201).json({
        success: true,
        data: instance,
      });
    } catch (error) {
      if (respondWhatsAppNotConfigured(res, error)) {
        return;
      }
      throw error;
    }
  })
);

// POST /api/integrations/whatsapp/instances/:id/start - Iniciar instância
router.post(
  '/whatsapp/instances/:id/start',
  param('id').isString(),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const instanceId = req.params.id;

    await whatsappBrokerClient.connectInstance(instanceId);

    res.json({
      success: true,
      message: 'Instance started successfully',
    });
  })
);

// POST /api/integrations/whatsapp/instances/:id/stop - Parar instância
router.post(
  '/whatsapp/instances/:id/stop',
  param('id').isString(),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const instanceId = req.params.id;

    await whatsappBrokerClient.disconnectInstance(instanceId);

    res.json({
      success: true,
      message: 'Instance stopped successfully',
    });
  })
);

// DELETE /api/integrations/whatsapp/instances/:id - Deletar instância
router.delete(
  '/whatsapp/instances/:id',
  param('id').isString(),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const instanceId = req.params.id;

    await whatsappBrokerClient.deleteInstance(instanceId);

    res.json({
      success: true,
      message: 'Instance deleted successfully',
    });
  })
);

// GET /api/integrations/whatsapp/instances/:id/qr - Obter QR Code
router.get(
  '/whatsapp/instances/:id/qr',
  param('id').isString(),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const instanceId = req.params.id;
    try {
      const qr = await whatsappBrokerClient.getQrCode(instanceId);

      res.json({
        success: true,
        data: qr,
      });
    } catch (error) {
      if (respondWhatsAppNotConfigured(res, error)) {
        return;
      }
      throw error;
    }
  })
);

// GET /api/integrations/whatsapp/instances/:id/status - Obter status da instância
router.get(
  '/whatsapp/instances/:id/status',
  param('id').isString(),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const instanceId = req.params.id;
    try {
      const status = await whatsappBrokerClient.getStatus(instanceId);

      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      if (respondWhatsAppNotConfigured(res, error)) {
        return;
      }
      throw error;
    }
  })
);

// POST /api/integrations/whatsapp/instances/:id/send - Enviar mensagem
router.post(
  '/whatsapp/instances/:id/send',
  param('id').isString(),
  body('to').isString(),
  body('content').isString(),
  body('type')
    .optional()
    .isIn(['text', 'image', 'audio', 'video', 'document', 'location', 'contact', 'template']),
  body('mediaUrl').optional().isURL(),
  body('caption').optional().isString(),
  body('mimeType').optional().isString(),
  body('fileName').optional().isString(),
  body('ptt').optional().isBoolean().toBoolean(),
  body('location').optional().isObject(),
  body('location.latitude').optional().isFloat({ min: -90, max: 90 }).toFloat(),
  body('location.longitude').optional().isFloat({ min: -180, max: 180 }).toFloat(),
  body('location.name').optional().isString(),
  body('location.address').optional().isString(),
  body('contact').optional().isObject(),
  body('contact.displayName').optional().isString(),
  body('contact.vcard').optional().isString(),
  body('template').optional().isObject(),
  body('template.name').optional().isString(),
  body('template.namespace').optional().isString(),
  body('template.language').optional().isString(),
  body('template.languageCode').optional().isString(),
  body('template.components').optional().isArray(),
  body('template.variables').optional().isArray(),
  body('template.parameters').optional().isArray(),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const instanceId = req.params.id;
    const {
      to,
      content,
      type = 'text',
      mediaUrl,
      caption,
      mimeType,
      fileName,
      ptt,
      location,
      contact,
      template,
    } = req.body as {
      to: string;
      content: string;
      type?: string;
      mediaUrl?: string;
      caption?: string;
      mimeType?: string;
      fileName?: string;
      ptt?: boolean;
      location?: {
        latitude: number;
        longitude: number;
        name?: string;
        address?: string;
      };
      contact?: {
        displayName?: string;
        vcard: string;
      };
      template?: {
        name: string;
        namespace?: string;
        language?: string;
        languageCode?: string;
        components?: unknown[];
        variables?: unknown[];
        parameters?: unknown[];
      };
    };

    try {
      const result = await whatsappBrokerClient.sendMessage(instanceId, {
        to,
        content,
        type,
        mediaUrl,
        caption,
        mimeType,
        fileName,
        ptt,
        location,
        contact,
        template,
      });

      res.json({
        success: true,
        data: result,
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
