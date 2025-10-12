import { Prisma, type Tenant } from '@prisma/client';

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
