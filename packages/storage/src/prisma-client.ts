import type { PrismaClient } from '@prisma/client';

let prismaClient: PrismaClient | null = null;

export const setPrismaClient = (client: PrismaClient): void => {
  prismaClient = client;
};

export const getPrismaClient = (): PrismaClient => {
  if (!prismaClient) {
    const error = new Error('Prisma client is not configured for @ticketz/storage');
    (error as Error & { code?: string }).code = 'STORAGE_PRISMA_NOT_CONFIGURED';
    throw error;
  }

  return prismaClient;
};
