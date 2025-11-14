import { Prisma, PrismaClient } from '@prisma/client';
import { ensureTicketStageSupport, setPrismaClient } from '@ticketz/storage';
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

if (!process.env.PRISMA_CLIENT_ENGINE_TYPE) {
  process.env.PRISMA_CLIENT_ENGINE_TYPE = 'library';
}

const DEFAULT_CONNECTION_LIMIT = 5;
const DEFAULT_POOL_TIMEOUT_SECONDS = 5;

const parsePositiveInteger = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const tuneDatabaseUrl = (
  rawUrl: string | undefined,
  {
    connectionLimit,
    poolTimeoutSeconds,
    enablePgBouncer,
  }: { connectionLimit: number; poolTimeoutSeconds: number; enablePgBouncer: boolean }
): { url: string | undefined; wasTuned: boolean } => {
  if (!rawUrl) {
    return { url: rawUrl, wasTuned: false };
  }

  try {
    const parsed = new URL(rawUrl);
    let wasTuned = false;

    if (!parsed.searchParams.has('connection_limit')) {
      parsed.searchParams.set('connection_limit', String(connectionLimit));
      wasTuned = true;
    }

    if (!parsed.searchParams.has('pool_timeout')) {
      parsed.searchParams.set('pool_timeout', String(poolTimeoutSeconds));
      wasTuned = true;
    }

    if (enablePgBouncer && !parsed.searchParams.has('pgbouncer')) {
      parsed.searchParams.set('pgbouncer', 'true');
      wasTuned = true;
    }

    return { url: parsed.toString(), wasTuned };
  } catch (error) {
    logger.warn('[Prisma] Failed to tune database URL', { error });
    return { url: rawUrl, wasTuned: false };
  }
};

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const linkPrismaToStorage = (client: PrismaClient, context: string) => {
  try {
    setPrismaClient(client);
  } catch (error) {
    logger.warn(`[Prisma] Failed to link storage client (${context})`, { error });
  }
};

const createPrismaClient = (): PrismaClient => {
  if (!isDatabaseEnabled) {
    logger.warn('[Prisma] Database URL missing — running in demo mode with storage disabled.');
    const disabledClient = buildDisabledClient();
    linkPrismaToStorage(disabledClient, 'disabled');
    return disabledClient;
  }

  const connectionLimit = parsePositiveInteger(
    process.env.DATABASE_CONNECTION_LIMIT,
    DEFAULT_CONNECTION_LIMIT
  );
  const poolTimeoutSeconds = parsePositiveInteger(
    process.env.DATABASE_POOL_TIMEOUT,
    DEFAULT_POOL_TIMEOUT_SECONDS
  );
  const enablePgBouncer =
    (process.env.DATABASE_ENABLE_PGBOUNCER ?? '').trim().toLowerCase() === 'true';

  const tunedUrl = tuneDatabaseUrl(process.env.DATABASE_URL, {
    connectionLimit,
    poolTimeoutSeconds,
    enablePgBouncer,
  });
  if (tunedUrl.wasTuned && tunedUrl.url) {
    process.env.DATABASE_URL = tunedUrl.url;
    logger.info('[Prisma] Connection tuning applied', {
      connectionLimit,
      poolTimeoutSeconds,
      enablePgBouncer,
    });
  }

  const existingClient = globalForPrisma.prisma;
  if (existingClient) {
    linkPrismaToStorage(existingClient, 'reuse');
    return existingClient;
  }

  const prismaOptions: Prisma.PrismaClientOptions = {
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'info' },
      { emit: 'event', level: 'warn' },
    ],
  };

  if (tunedUrl.url) {
    prismaOptions.datasources = {
      db: {
        url: tunedUrl.url,
      },
    };
  }

  const client = new PrismaClient(prismaOptions);
  linkPrismaToStorage(client, 'create');

  return client;
};

export const prisma = createPrismaClient();

if (isDatabaseEnabled) {
  await ensureTicketStageSupport(prisma, { logger });
}

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
