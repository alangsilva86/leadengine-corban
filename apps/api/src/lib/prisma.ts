import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: [
    {
      emit: 'event',
      level: 'query',
    },
    {
      emit: 'event',
      level: 'error',
    },
    {
      emit: 'event',
      level: 'info',
    },
    {
      emit: 'event',
      level: 'warn',
    },
  ],
});

// Log das queries em desenvolvimento
if (process.env.NODE_ENV === 'development') {
  prisma.$on('query', (e) => {
    logger.debug('[Prisma] Query executed', {
      query: e.query,
      params: e.params,
      duration: `${e.duration}ms`,
    });
  });
}

prisma.$on('error', (e) => {
  logger.error('[Prisma] Database error', {
    message: e.message,
    target: e.target,
  });
});

prisma.$on('info', (e) => {
  logger.info('[Prisma] Database info', {
    message: e.message,
    target: e.target,
  });
});

prisma.$on('warn', (e) => {
  logger.warn('[Prisma] Database warning', {
    message: e.message,
    target: e.target,
  });
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Função para conectar ao banco
export async function connectDatabase() {
  try {
    await prisma.$connect();
    logger.info('[Prisma] ✅ Conectado ao banco de dados PostgreSQL');
    
    // Testar a conexão
    await prisma.$queryRaw`SELECT 1`;
    logger.info('[Prisma] ✅ Conexão testada com sucesso');
  } catch (error) {
    logger.error('[Prisma] ❌ Falha ao conectar ao banco de dados', { error });
    throw error;
  }
}

// Função para desconectar do banco
export async function disconnectDatabase() {
  try {
    await prisma.$disconnect();
    logger.info('[Prisma] 🔌 Desconectado do banco de dados');
  } catch (error) {
    logger.error('[Prisma] ❌ Erro ao desconectar do banco de dados', { error });
  }
}

// Graceful shutdown
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
