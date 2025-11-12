import { Prisma, type PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../prisma-client';

type PrismaClientOrTx = PrismaClient | Prisma.TransactionClient;

const resolveClient = (client?: PrismaClientOrTx): PrismaClientOrTx => client ?? getPrismaClient();

const normalizeValue = (value: Prisma.JsonValue | null | undefined): Prisma.JsonValue | null => {
  if (value === null || value === undefined) {
    return Prisma.JsonNull;
  }
  return value;
};

export const getIntegrationState = async (
  key: string,
  client?: PrismaClientOrTx
): Promise<Prisma.JsonValue | null> => {
  const prisma = resolveClient(client);
  const record = await prisma.integrationState.findUnique({
    where: { key },
    select: { value: true },
  });
  return record?.value ?? null;
};

export const upsertIntegrationState = async (
  key: string,
  value: Prisma.JsonValue | null | undefined,
  client?: PrismaClientOrTx
): Promise<Prisma.JsonValue | null> => {
  const prisma = resolveClient(client);
  const record = await prisma.integrationState.upsert({
    where: { key },
    update: { value: normalizeValue(value) },
    create: { key, value: normalizeValue(value) },
  });
  return record.value ?? null;
};

export const deleteIntegrationState = async (
  key: string,
  client?: PrismaClientOrTx
): Promise<void> => {
  const prisma = resolveClient(client);
  await prisma.integrationState.deleteMany({ where: { key } });
};

export const __testing = {
  normalizeValue,
};
