import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger';

export interface DatabaseDisabledErrorContext {
  model?: string;
  operation?: string;
}

export class DatabaseDisabledError extends Error {
  public readonly code = 'DATABASE_DISABLED';
  public readonly status = 503;
  public readonly context: DatabaseDisabledErrorContext;

  constructor(context: DatabaseDisabledErrorContext = {}) {
    super('Database access is disabled for this deployment.');
    this.name = 'DatabaseDisabledError';
    this.context = context;
  }
}

class DisabledPrismaModelProxy {
  private readonly modelName: string;

  constructor(modelName: string) {
    this.modelName = modelName;
  }

  private buildReadFallback(operation: string) {
    const model = this.modelName;
    if (operation === 'findMany') {
      return async () => [];
    }

    if (operation === 'findFirst' || operation === 'findUnique') {
      return async () => null;
    }

    if (operation === 'count') {
      return async () => 0;
    }

    return async () => {
      throw new DatabaseDisabledError({ model, operation });
    };
  }

  public getProxy(): Record<string, unknown> {
    return new Proxy(
      {},
      {
        get: (_target, property) => {
          if (typeof property !== 'string') {
            return undefined;
          }

          return this.buildReadFallback(property);
        },
      }
    );
  }
}

const DISABLED_CLIENT_METHODS = new Set(['$connect', '$disconnect', '$on', '$use', '$transaction', '$extends']);

const buildDisabledClient = (): PrismaClient => {
  const disabledClient = new Proxy(
    {},
    {
      get: (_target, property) => {
        if (typeof property !== 'string') {
          return undefined;
        }

        if (DISABLED_CLIENT_METHODS.has(property)) {
          if (property === '$transaction') {
            return async () => {
              throw new DatabaseDisabledError({ operation: '$transaction' });
            };
          }

          return async () => undefined;
        }

        return new DisabledPrismaModelProxy(property).getProxy();
      },
    }
  );

  return disabledClient as PrismaClient;
};

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());

export const isDatabaseEnabled = hasDatabaseUrl;

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const createPrismaClient = (): PrismaClient => {
  if (!isDatabaseEnabled) {
    logger.warn('[Prisma] Database URL missing — running in demo mode with storage disabled.');
    return buildDisabledClient();
  }

  const existingClient = globalForPrisma.prisma;
  if (existingClient) {
    void import('@ticketz/storage')
      .then(({ setPrismaClient }) => {
        setPrismaClient(existingClient);
      })
      .catch((error) => {
        logger.warn('[Prisma] Failed to link storage client (reuse)', { error });
      });
    return existingClient;
  }

  const client = new PrismaClient({
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'info' },
      { emit: 'event', level: 'warn' },
    ],
  });

  void import('@ticketz/storage')
    .then(({ setPrismaClient }) => {
      setPrismaClient(client);
    })
    .catch((error) => {
      logger.warn('[Prisma] Failed to link storage client', { error });
    });

  return client;
};

export const prisma = createPrismaClient();

if (isDatabaseEnabled && process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export async function disconnectDatabase() {
  if (!isDatabaseEnabled) {
    return;
  }

  try {
    await prisma.$disconnect();
    logger.info('[Prisma] 🔌 Desconectado do banco de dados');
  } catch (error) {
    logger.error('[Prisma] ❌ Erro ao desconectar do banco de dados', { error });
  }
}

process.on('beforeExit', async () => {
  await disconnectDatabase();
});

process.on('SIGINT', async () => {
  await disconnectDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await disconnectDatabase();
  process.exit(0);
});
