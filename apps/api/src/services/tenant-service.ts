import { Prisma, type Tenant } from '@prisma/client';

import type { Request } from 'express';

import { assertTenantConsistency, ensureTenantFromUser, normalizeTenantId } from '@ticketz/storage';

import { prisma } from '../lib/prisma';
import { toSlug } from '../lib/slug';
import { logger } from '../config/logger';

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

export const resolveRequestTenantId = (req: Request, requestedTenantId?: unknown): string => {
  const payloadTenant = normalizeTenantId(requestedTenantId);
  const tenantId = ensureTenantFromUser(req.user, buildTenantLogContext(req, 'user'));

  if (payloadTenant) {
    assertTenantConsistency(tenantId, payloadTenant, buildTenantLogContext(req, 'payload'));
  }

  const headerTenant = readTenantHeader(req);
  if (headerTenant) {
    assertTenantConsistency(tenantId, headerTenant, buildTenantLogContext(req, 'header'));
  }

  const queryTenant = readTenantQuery(req);
  if (queryTenant) {
    assertTenantConsistency(tenantId, queryTenant, buildTenantLogContext(req, 'query'));
  }

  return tenantId;
};

export const ensureTenantParamAccess = (req: Request, tenantId?: string | null): string => {
  const normalized = normalizeTenantId(tenantId);
  return resolveRequestTenantId(req, normalized ?? undefined);
};
