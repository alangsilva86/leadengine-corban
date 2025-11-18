import { Prisma, type Tenant } from '@prisma/client';

import type { Request } from 'express';

import { assertTenantConsistency, ensureTenantFromUser, normalizeTenantId } from '@ticketz/storage';

import { prisma } from '../lib/prisma';
import { toSlug } from '../lib/slug';
import { logger } from '../config/logger';
import { getMvpBypassTenantId } from '../config/feature-flags';

export type TenantLogContext = Record<string, unknown>;

const logErrorPayload = (error: unknown): Record<string, unknown> => {
  if (error instanceof Error) {
    const base: Record<string, unknown> = {
      name: error.name,
      message: error.message,
    };

    const code = (error as { code?: unknown }).code;
    if (code !== undefined) {
      base.code = code;
    }

    return base;
  }

  return { error };
};

export const ensureTenantRecord = async (
  tenantId: string,
  logContext: TenantLogContext = {}
): Promise<Tenant> => {
  const slug = toSlug(tenantId, tenantId);

  const existingTenant = await prisma.tenant.findFirst({
    where: {
      OR: [{ id: tenantId }, { slug }],
    },
  });

  if (existingTenant) {
    if (existingTenant.slug === slug && existingTenant.id !== tenantId) {
      logger.info('[Tenant] Reusing tenant slug for different tenant id', {
        ...logContext,
        requestedTenantId: tenantId,
        effectiveTenantId: existingTenant.id,
        slug,
      });
    }

    return existingTenant;
  }

  try {
    const created = await prisma.tenant.create({
      data: {
        id: tenantId,
        name: tenantId,
        slug,
        settings: {},
      },
    });

    logger.info('[Tenant] Created tenant on demand', {
      ...logContext,
      tenantId: created.id,
      slug: created.slug,
    });

    return created;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const conflictingTenant = await prisma.tenant.findFirst({
        where: { slug },
      });

      if (conflictingTenant) {
        logger.info('[Tenant] Resolved tenant slug conflict by reusing existing record', {
          ...logContext,
          requestedTenantId: tenantId,
          effectiveTenantId: conflictingTenant.id,
          slug,
        });

        return conflictingTenant;
      }
    }

    logger.error('[Tenant] Failed to ensure tenant record', {
      ...logContext,
      tenantId,
      slug,
      error: logErrorPayload(error),
    });

    throw error;
  }
};

const readTenantHeader = (req: Request): string | null => {
  const header = req.headers['x-tenant-id'];

  if (Array.isArray(header)) {
    return header.find((entry): entry is string => typeof entry === 'string')?.trim() ?? null;
  }

  if (typeof header === 'string') {
    const trimmed = header.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  const viaFn = req.header?.('x-tenant-id');
  if (typeof viaFn === 'string') {
    const trimmed = viaFn.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  return null;
};

const readTenantQuery = (req: Request): string | null => {
  const candidate = req.query?.tenantId;

  if (Array.isArray(candidate)) {
    for (const entry of candidate) {
      const normalized = normalizeTenantId(entry);
      if (normalized) {
        return normalized;
      }
    }
    return null;
  }

  return normalizeTenantId(candidate);
};

const buildTenantLogContext = (req: Request, source: string): Record<string, unknown> => ({
  source,
  requestId: req.rid ?? null,
  path: req.originalUrl ?? req.url ?? null,
  userId: req.user?.id ?? null,
});

export interface TenantResolutionHookContext {
  req: Request;
  requestedTenantId: string | null;
  headerTenantId: string | null;
  queryTenantId: string | null;
  userTenantId: string | null;
}

export type TenantResolutionHook = (context: TenantResolutionHookContext) => string | null | undefined;

const tenantResolutionHooks: TenantResolutionHook[] = [];

const legacyMvpBypassTenantHook: TenantResolutionHook = ({ userTenantId }) => {
  if (userTenantId) {
    return null;
  }

  return getMvpBypassTenantId() ?? 'demo-tenant';
};

const registerDefaultTenantHooks = () => {
  tenantResolutionHooks.push(legacyMvpBypassTenantHook);
};

registerDefaultTenantHooks();

export const registerTenantResolutionHook = (hook: TenantResolutionHook): (() => void) => {
  tenantResolutionHooks.push(hook);
  return () => {
    const index = tenantResolutionHooks.indexOf(hook);
    if (index >= 0) {
      tenantResolutionHooks.splice(index, 1);
    }
  };
};

export const resetTenantResolutionHooks = (): void => {
  tenantResolutionHooks.splice(0, tenantResolutionHooks.length);
  registerDefaultTenantHooks();
};

const resolveTenantFromHooks = (context: TenantResolutionHookContext): string | null => {
  for (const hook of tenantResolutionHooks) {
    try {
      const result = hook(context);
      const normalized = normalizeTenantId(result);
      if (normalized) {
        return normalized;
      }
    } catch (error) {
      logger.warn('[Tenant] Tenant resolution hook failed', {
        ...buildTenantLogContext(context.req, 'hook'),
        error: logErrorPayload(error),
      });
    }
  }

  return null;
};

export const resolveRequestTenantId = (req: Request, requestedTenantId?: unknown): string => {
  const payloadTenant = normalizeTenantId(requestedTenantId);
  const headerTenant = readTenantHeader(req);
  const queryTenant = readTenantQuery(req);
  const userTenantId = normalizeTenantId(req.user?.tenantId);

  const resolvedByHook = resolveTenantFromHooks({
    req,
    requestedTenantId: payloadTenant,
    headerTenantId: headerTenant,
    queryTenantId: queryTenant,
    userTenantId,
  });

  if (resolvedByHook) {
    if (payloadTenant) {
      assertTenantConsistency(resolvedByHook, payloadTenant, buildTenantLogContext(req, 'payload'));
    }

    if (headerTenant) {
      assertTenantConsistency(resolvedByHook, headerTenant, buildTenantLogContext(req, 'header'));
    }

    if (queryTenant) {
      assertTenantConsistency(resolvedByHook, queryTenant, buildTenantLogContext(req, 'query'));
    }

    return resolvedByHook;
  }

  const tenantId = ensureTenantFromUser(req.user, buildTenantLogContext(req, 'user'));

  if (payloadTenant) {
    assertTenantConsistency(tenantId, payloadTenant, buildTenantLogContext(req, 'payload'));
  }

  if (headerTenant) {
    assertTenantConsistency(tenantId, headerTenant, buildTenantLogContext(req, 'header'));
  }

  if (queryTenant) {
    assertTenantConsistency(tenantId, queryTenant, buildTenantLogContext(req, 'query'));
  }

  return tenantId;
};

export const ensureTenantParamAccess = (req: Request, tenantId?: string | null): string => {
  const normalized = normalizeTenantId(tenantId);
  return resolveRequestTenantId(req, normalized ?? undefined);
};

export const resolveRequestActorId = (req: Request): string => {
  const userId = typeof req.user?.id === 'string' ? req.user.id.trim() : '';
  return userId.length > 0 ? userId : 'system';
};
