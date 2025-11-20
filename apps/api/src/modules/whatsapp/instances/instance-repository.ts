import { prisma } from '../../../lib/prisma';
import type { StoredInstance } from './types';

export type InstanceRepository = {
  findByTenant: (tenantId: string) => Promise<StoredInstance[]>;
  updatePhoneNumber: (instanceId: string, phoneNumber: string) => Promise<void>;
};

export const createPrismaInstanceRepository = (client: typeof prisma = prisma): InstanceRepository => ({
  findByTenant: async (tenantId: string) => {
    return (await client.whatsAppInstance.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    })) as StoredInstance[];
  },
  updatePhoneNumber: async (instanceId: string, phoneNumber: string) => {
    await client.whatsAppInstance.update({
      where: { id: instanceId },
      data: { phoneNumber },
    });
  },
});

export const defaultInstanceRepository = createPrismaInstanceRepository();
