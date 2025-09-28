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

// Logs do Prisma são configurados via log array acima

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
