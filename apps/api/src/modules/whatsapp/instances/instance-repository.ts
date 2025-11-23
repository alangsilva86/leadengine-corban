import { Prisma } from '@prisma/client';
import { prisma } from '../../../lib/prisma';
import { logger } from '../../../config/logger';
import type { StoredInstance } from './types';

export type InstanceRepository = {
  findByTenant: (tenantId: string) => Promise<StoredInstance[]>;
  updatePhoneNumber: (
    tenantId: string,
    instanceId: string,
    phoneNumber: string
  ) => Promise<void>;
};

export const createPrismaInstanceRepository = (client: typeof prisma = prisma): InstanceRepository => ({
  findByTenant: async (tenantId: string) => {
    const records = await client.whatsAppInstance.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });

    const filtered = (records as StoredInstance[]).filter((instance) => instance.tenantId === tenantId);
    const discarded = records.length - filtered.length;

    if (discarded > 0) {
      logger.warn('whatsapp.instances.repository.filteredForeignInstances', {
        tenantId,
        total: records.length,
        discarded,
      });
    }

    return filtered;
  },
  updatePhoneNumber: async (tenantId: string, instanceId: string, phoneNumber: string) => {
    try {
      await client.whatsAppInstance.update({
        where: { id: instanceId, tenantId },
        data: { phoneNumber },
      });
    } catch (error) {
      const isKnownRequestError =
        typeof Prisma.PrismaClientKnownRequestError === 'function' &&
        error instanceof Prisma.PrismaClientKnownRequestError;
      const isNotFoundError =
        (isKnownRequestError && (error as Prisma.PrismaClientKnownRequestError).code === 'P2025') ||
        (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 'P2025');

      if (isNotFoundError) {
        logger.warn('whatsapp.instances.repository.updatePhoneNumber.notFound', {
          tenantId,
          instanceId,
        });
      }

      throw error;
    }
  },
});

export const defaultInstanceRepository = createPrismaInstanceRepository();
