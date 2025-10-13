import type { PrismaClient } from '@prisma/client';

let prismaClient: PrismaClient | null = null;
let fallbackClient: PrismaClient | null = null;

const createDisabledClient = (): PrismaClient => {
  const modelHandler: ProxyHandler<Record<string, unknown>> = {
    get: (_target, property) => {
      if (typeof property !== 'string') {
        return undefined;
      }

      if (property === 'findMany') {
        return async () => [];
      }

      if (property === 'findFirst' || property === 'findUnique') {
        return async () => null;
      }

      if (property === 'count') {
        return async () => 0;
      }

      return async () => {
        const error = new Error('Database access is disabled for this environment.');
        (error as Error & { code?: string }).code = 'STORAGE_DATABASE_DISABLED';
        throw error;
      };
    },
  };

  const clientHandler: ProxyHandler<Record<string, unknown>> = {
    get: (_target, property) => {
      if (typeof property !== 'string') {
        return undefined;
      }

      if (property.startsWith('$')) {
        if (property === '$transaction') {
          return async () => {
            const error = new Error('Database access is disabled for this environment.');
            (error as Error & { code?: string }).code = 'STORAGE_DATABASE_DISABLED';
            throw error;
          };
        }

        return async () => undefined;
      }

      return new Proxy({}, modelHandler);
    },
  };

  return new Proxy({}, clientHandler) as PrismaClient;
};

export const setPrismaClient = (client: PrismaClient): void => {
  prismaClient = client;
};

export const getPrismaClient = (): PrismaClient => {
  if (prismaClient) {
    return prismaClient;
  }

  if (!process.env.DATABASE_URL) {
    if (!fallbackClient) {
      fallbackClient = createDisabledClient();
    }
    return fallbackClient;
  }

  const error = new Error('Prisma client is not configured for @ticketz/storage');
  (error as Error & { code?: string }).code = 'STORAGE_PRISMA_NOT_CONFIGURED';
  throw error;
};
