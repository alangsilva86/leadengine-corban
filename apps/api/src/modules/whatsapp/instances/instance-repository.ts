import { prisma } from '../../../lib/prisma';
import { logger } from '../../../config/logger';
import type { StoredInstance } from './types';

export type InstanceRepository = {
  findByTenant: (tenantId: string) => Promise<StoredInstance[]>;
  updatePhoneNumber: (instanceId: string, phoneNumber: string) => Promise<void>;
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
  updatePhoneNumber: async (instanceId: string, phoneNumber: string) => {
    await client.whatsAppInstance.update({
      where: { id: instanceId },
      data: { phoneNumber },
    });
  },
});

export const defaultInstanceRepository = createPrismaInstanceRepository();
