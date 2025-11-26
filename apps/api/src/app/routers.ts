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

type CacheEntry<T> = { data: T; expiresAt: number };

const CACHE_TTL_MS = 15_000;
const debugCache = new Map<string, CacheEntry<unknown>>();

const getCachedValue = <T>(key: string): T | null => {
  const cached = debugCache.get(key);

  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    debugCache.delete(key);
    return null;
  }

  return cached.data as T;
};

const setCachedValue = <T>(key: string, data: T, ttlMs = CACHE_TTL_MS) => {
  debugCache.set(key, { data, expiresAt: Date.now() + ttlMs });
};

const parseNumberQueryParam = (value: unknown, { defaultValue, max, min = 0 }: { defaultValue: number; max?: number; min?: number }): number => {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number.NaN;
  const bounded = Number.isFinite(parsed) ? parsed : defaultValue;
  const withMin = Math.max(min ?? 0, bounded);

  if (typeof max === 'number') {
    return Math.min(max, withMin);
  }

  return withMin;
};

type AiAutoReplyPayload = {
  note: string;
  ok: true;
  timestamp: string;
  environment: string;
  openaiKeyConfigured: boolean;
  loggerTransports: { name: string; level: string }[];
  tenants: { id: string; slug: string; aiEnabled: boolean; aiMode: unknown; aiModel: unknown }[];
};

type AiConfigDebugPayload = {
  ok: true;
  note: string;
  tenantId: string;
  scopeKey: string;
  config: {
    model: string;
    defaultMode: string;
    temperature: number;
    streamingEnabled: boolean;
    vectorStoreEnabled: boolean;
    vectorStoreIds: string[];
    confidenceThreshold: number | null;
    maxOutputTokens: number | null;
    updatedAt: string;
    createdAt: string;
  } | null;
};

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

  app.get('/_diag/ai-auto-reply', authMiddleware, requirePlatformAdmin, async (req, res) => {
    try {
      const { prisma } = await import('../lib/prisma');

      const tenantId = typeof req.query.tenantId === 'string' ? req.query.tenantId : undefined;
      const take = parseNumberQueryParam(req.query.take, { defaultValue: 25, max: 100, min: 1 });
      const skip = parseNumberQueryParam(req.query.skip, { defaultValue: 0, min: 0 });
      const cacheKey = `ai-auto-reply:${tenantId ?? 'all'}:${take}:${skip}`;

      const cachedResponse = getCachedValue<AiAutoReplyPayload>(cacheKey);

      if (cachedResponse) {
        logger.info('🔍 AI AUTO-REPLY DEBUG ENDPOINT CACHED', { tenantId, take, skip });
        res.status(200).json({ ...cachedResponse, cached: true });
        return;
      }

      const tenants = await prisma.tenant.findMany({
        where: tenantId ? { id: tenantId } : undefined,
        select: {
          id: true,
          slug: true,
          aiEnabled: true,
          aiMode: true,
          aiModel: true,
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      });

      const payload = {
        note:
          'Endpoint de observabilidade para admins da plataforma: exibe status de AI Auto-Reply sem dados sensíveis.',
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

      setCachedValue(cacheKey, payload);
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

  app.get('/_debug/ai-config', authMiddleware, requirePlatformAdmin, async (req, res) => {
    try {
      const { prisma } = await import('../lib/prisma');

      const tenantId = typeof req.query.tenantId === 'string' ? req.query.tenantId : 'demo-tenant';
      const scopeKey = typeof req.query.scopeKey === 'string' ? req.query.scopeKey : '__global__';
      const cacheKey = `ai-config:${tenantId}:${scopeKey}`;

      const cached = getCachedValue<AiConfigDebugPayload>(cacheKey);

      if (cached) {
        res.json({ ...cached, cached: true });
        return;
      }

      const aiConfig = await prisma.aiConfig.findUnique({
        where: { tenantId_scopeKey: { tenantId, scopeKey } },
        select: {
          model: true,
          defaultMode: true,
          temperature: true,
          streamingEnabled: true,
          vectorStoreEnabled: true,
          vectorStoreIds: true,
          confidenceThreshold: true,
          maxOutputTokens: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const payload: AiConfigDebugPayload = {
        ok: true,
        note:
          'Observabilidade: mostra configuração de AI por tenant/scope apenas para administradores, sem prompts ou segredos.',
        tenantId,
        scopeKey,
        config: aiConfig
          ? {
              model: aiConfig.model,
              defaultMode: aiConfig.defaultMode,
              temperature: aiConfig.temperature,
              streamingEnabled: aiConfig.streamingEnabled,
              vectorStoreEnabled: aiConfig.vectorStoreEnabled,
              vectorStoreIds: aiConfig.vectorStoreIds,
              confidenceThreshold: aiConfig.confidenceThreshold,
              maxOutputTokens: aiConfig.maxOutputTokens,
              updatedAt: aiConfig.updatedAt.toISOString(),
              createdAt: aiConfig.createdAt.toISOString(),
            }
          : null,
      };

      setCachedValue(cacheKey, payload);
      res.json(payload);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.post('/_debug/ai-config/update', authMiddleware, requirePlatformAdmin, async (req, res) => {
    try {
      const { prisma } = await import('../lib/prisma');
      const tenantId = typeof req.body?.tenantId === 'string' ? req.body.tenantId : 'demo-tenant';
      const scopeKey = typeof req.body?.scopeKey === 'string' ? req.body.scopeKey : '__global__';

      const updated = await prisma.aiConfig.update({
        where: { tenantId_scopeKey: { tenantId, scopeKey } },
        data: { defaultMode: 'IA_AUTO' },
      });

      debugCache.delete(`ai-config:${tenantId}:${scopeKey}`);
      res.json({ success: true, tenantId, scopeKey, updatedFields: { defaultMode: updated.defaultMode } });
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
