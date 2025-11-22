import type { Application, Router } from 'express';

import type { Logger } from '../types/logger';
import { renderMetrics } from '../lib/metrics';
import { buildHealthPayload } from '../health';
import { authMiddleware, requireTenant } from '../middleware/auth';
import { requirePlatformAdmin } from '../middleware/platform-admin';
import { authRouter } from '../routes/auth';
import { onboardingRouter } from '../routes/onboarding';
import { onboardingInvitationsRouter } from '../routes/onboarding-invitations';
import { integrationWebhooksRouter, webhooksRouter } from '../routes/webhooks';
import { leadEngineRouter } from '../routes/lead-engine';
import { aiRouter } from '../routes/ai';
import { crmRouter } from '../routes/crm';
import { ticketsRouter } from '../routes/tickets';
import { leadsRouter } from '../routes/leads';
import { contactsRouter } from '../routes/contacts';
import { contactTasksRouter } from '../routes/contact-tasks';
import { ticketMessagesRouter } from '../routes/messages.ticket';
import { contactMessagesRouter } from '../routes/messages.contact';
import { whatsappMessagesRouter } from '../routes/integrations/whatsapp.messages';
import { whatsappUploadsRouter } from '../routes/whatsapp.uploads';
import { integrationsRouter } from '../routes/integrations';
import { campaignsRouter } from '../routes/campaigns';
import { reportsRouter } from '../routes/reports';
import { queuesRouter } from '../routes/queues';
import { preferencesRouter } from '../routes/preferences';
import { agreementsRouter } from '../routes/agreements';
import { agreementsProvidersRouter } from '../routes/agreements.providers';
import { tenantsRouter } from '../routes/tenants';
import { usersRouter } from '../routes/users';
import { salesRouter } from '../routes/sales';
import { whatsappDebugRouter } from '../features/debug/routes/whatsapp-debug';
import { isWhatsappDebugToolsEnabled } from '../config/feature-flags';
import { tenantAdminRouterFactory } from '../modules/tenant-admin/tenants.routes';
import { errorHandler } from '../middleware/error-handler';
import { getBrokerBaseUrl } from '../config/whatsapp';
import { logAiConfiguration } from '../config/ai';
import { getReadinessState } from './readiness';

import {
  debugMessagesRouter as enabledDebugMessagesRouter,
  buildDisabledDebugMessagesRouter,
} from '../features/debug/routes/messages';

type RegisterRoutersDeps = {
  logger: Logger;
  nodeEnv: string;
  debugMessagesRouter: Router;
};

export const buildDebugMessagesRouter = (shouldRegisterWhatsappDebugRoutes: boolean): Router =>
  shouldRegisterWhatsappDebugRoutes ? enabledDebugMessagesRouter : buildDisabledDebugMessagesRouter();

export const registerRouters = (app: Application, { logger, nodeEnv, debugMessagesRouter }: RegisterRoutersDeps) => {
  const tenantAdminRouter = tenantAdminRouterFactory();

  app.get('/metrics', async (_req, res) => {
    const payload = await renderMetrics();
    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.status(200).send(payload);
    logger.info('📈 Métricas Prometheus servidas', {
      endpoint: '/metrics',
      sizeInBytes: payload.length,
    });
  });

  app.get(['/health', '/healthz'], (_req, res) => {
    res.json({
      ...buildHealthPayload({ environment: nodeEnv }),
      readiness: getReadinessState(),
    });
  });

  app.get(['/ready', '/readiness'], (_req, res) => {
    const readiness = getReadinessState();
    const statusCode = readiness.ready ? 200 : 503;

    res.status(statusCode).json({
      ok: readiness.ready,
      status: readiness.status,
      reason: readiness.reason,
      since: readiness.since,
      lastReadyAt: readiness.lastReadyAt,
      lastNotReadyAt: readiness.lastNotReadyAt,
      transitions: readiness.transitions,
      metadata: readiness.metadata,
    });
  });

  app.get('/_diag/echo', (req, res) => {
    const payload = {
      ok: true,
      requestId: req.rid ?? null,
      method: req.method,
      path: req.originalUrl,
      headers: {
        'x-request-id': req.get('x-request-id') ?? null,
        'x-tenant-id': req.get('x-tenant-id') ?? null,
        authorization: req.get('authorization') ? true : false,
        'content-type': req.get('content-type') ?? null,
        'user-agent': req.get('user-agent') ?? null,
      },
    };

    res.status(200).json(payload);
  });

  app.get('/_diag/ai-auto-reply', async (_req, res) => {
    try {
      const { prisma } = await import('../lib/prisma');

      const tenants = await prisma.tenant.findMany({
        select: {
          id: true,
          slug: true,
          aiEnabled: true,
          aiMode: true,
          aiModel: true,
        },
      });

      const payload = {
        ok: true,
        timestamp: new Date().toISOString(),
        environment: nodeEnv,
        openaiKeyConfigured: !!process.env.OPENAI_API_KEY,
        loggerTransports: logger.transports.map((t: any) => ({
          name: t.name,
          level: t.level,
        })),
        tenants: tenants.map((t) => ({
          id: t.id,
          slug: t.slug,
          aiEnabled: t.aiEnabled,
          aiMode: t.aiMode,
          aiModel: t.aiModel,
        })),
      };

      logger.info('🔍 AI AUTO-REPLY DEBUG ENDPOINT ACCESSED', payload);
      res.status(200).json(payload);
    } catch (error) {
      logger.error('❌ Error in AI auto-reply debug endpoint', { error });
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  app.use('/api/auth', authRouter);
  app.use('/api/onboarding/invitations', authMiddleware, onboardingInvitationsRouter);
  app.use('/api/onboarding', onboardingRouter);
  app.use('/api/integrations', integrationWebhooksRouter);
  app.use('/api/webhooks', webhooksRouter);
  app.use('/api/lead-engine', authMiddleware, requireTenant, leadEngineRouter);
  app.use('/api/ai', authMiddleware, requireTenant, aiRouter);
  app.use('/api/tenant-admin/tenants', authMiddleware, requirePlatformAdmin, tenantAdminRouter);
  app.use('/api/crm', authMiddleware, crmRouter);
  app.use(
    '/api/debug/wa',
    (req, res, next) => {
      if (!isWhatsappDebugToolsEnabled()) {
        res.status(404).json({
          error: 'Not Found',
          message: `Route ${req.originalUrl} not found`,
        });
        return;
      }
      next();
    },
    whatsappDebugRouter,
  );
  app.use('/api', debugMessagesRouter);

  app.use('/api/tickets', authMiddleware, requireTenant, ticketsRouter);
  app.use('/api/leads', authMiddleware, requireTenant, leadsRouter);
  app.use('/api/contacts', authMiddleware, contactsRouter);
  app.use('/api/tasks', authMiddleware, contactTasksRouter);
  app.use('/api', authMiddleware, requireTenant, ticketMessagesRouter);
  app.use('/api', authMiddleware, contactMessagesRouter);
  app.use('/api', authMiddleware, whatsappMessagesRouter);
  app.use('/api', authMiddleware, whatsappUploadsRouter);
  app.use('/api/integrations', authMiddleware, integrationsRouter);
  app.use('/api/campaigns', authMiddleware, requireTenant, campaignsRouter);
  app.use('/api', authMiddleware, requireTenant, agreementsRouter);
  app.use('/api/agreements', authMiddleware, requireTenant, agreementsRouter);
  app.use('/api/reports', authMiddleware, requireTenant, reportsRouter);
  app.use('/api/queues', authMiddleware, requireTenant, queuesRouter);
  app.use('/api/sales', authMiddleware, requireTenant, salesRouter);
  app.use('/api/tenants', authMiddleware, requireTenant, tenantsRouter);
  app.use('/api/users', authMiddleware, requireTenant, usersRouter);
  app.use('/api/v1/agreements', authMiddleware, requireTenant, agreementsProvidersRouter);
  app.use('/api', authMiddleware, preferencesRouter);

  const rootAvailabilityPayload = {
    status: 'ok',
    environment: nodeEnv,
  };

  app.get('/', (_req, res) => {
    res.status(200).json(rootAvailabilityPayload);
  });

  app.head('/', (_req, res) => {
    const payloadString = JSON.stringify(rootAvailabilityPayload);

    res
      .status(200)
      .set({
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(payloadString).toString(),
      })
      .end();
  });

  app.get('/_debug/ai-config', async (req, res) => {
    try {
      const { prisma } = await import('../lib/prisma');
      const aiConfig = await prisma.aiConfig.findUnique({
        where: { tenantId: 'demo-tenant' },
      });
      res.json({
        tenantId: 'demo-tenant',
        aiConfig,
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.post('/_debug/ai-config/update', async (_req, res) => {
    try {
      const { prisma } = await import('../lib/prisma');
      const updated = await prisma.aiConfig.update({
        where: { tenantId: 'demo-tenant' },
        data: { defaultMode: 'IA_AUTO' },
      });
      res.json({ success: true, updated });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.use(errorHandler);

  app.use('*', (req, res) => {
    res.status(404).json({
      error: 'Not Found',
      message: `Route ${req.originalUrl} not found`,
    });
  });

  logger.info('💬 WhatsApp transport initialized using broker', {
    baseUrl: getBrokerBaseUrl(),
  });
  logAiConfiguration();
};
