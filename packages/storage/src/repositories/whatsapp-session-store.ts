import { BufferJSON } from '@whiskeysockets/baileys';
import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  WhatsAppSessionData,
  WhatsAppSessionStore
} from '@ticketz/integrations';

const prepareJsonValue = (data: WhatsAppSessionData): Prisma.InputJsonValue => {
  return JSON.parse(
    JSON.stringify(
      {
        ...data,
        updatedAt: data.updatedAt.toISOString()
      },
      BufferJSON.replacer
    )
  ) as Prisma.InputJsonValue;
};

const parseSessionData = (raw: string | Prisma.JsonValue): WhatsAppSessionData => {
  const stringified = typeof raw === 'string' ? raw : JSON.stringify(raw);
  const parsed = JSON.parse(stringified, BufferJSON.reviver) as WhatsAppSessionData;
  return {
    ...parsed,
    updatedAt: new Date(parsed.updatedAt)
  };
};

export const createPrismaWhatsAppSessionStore = (client: PrismaClient): WhatsAppSessionStore => ({
  async load(instanceId) {
    const record = await client.whatsAppSession.findUnique({
      where: { instanceId }
    });

    if (!record) {
      return null;
    }

    return parseSessionData(record.data);
  },
  async save(instanceId, data) {
    await client.whatsAppSession.upsert({
      where: { instanceId },
      create: {
        instanceId,
        data: prepareJsonValue(data)
      },
      update: {
        data: prepareJsonValue(data)
      }
    });
  },
  async delete(instanceId) {
    await client.whatsAppSession.delete({
      where: { instanceId }
    }).catch(() => undefined);
  }
});

type RedisClient = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: Record<string, unknown>): Promise<unknown>;
  del(key: string): Promise<unknown>;
};

const prepareRedisValue = (data: WhatsAppSessionData): string => {
  return JSON.stringify(
    {
      ...data,
      updatedAt: data.updatedAt.toISOString()
    },
    BufferJSON.replacer
  );
};

export interface RedisSessionStoreOptions {
  prefix?: string;
  ttlSeconds?: number;
}

export const createRedisWhatsAppSessionStore = (
  client: RedisClient,
  options: RedisSessionStoreOptions = {}
): WhatsAppSessionStore => {
  const prefix = options.prefix ?? 'whatsapp:session:';
  const ttlSeconds = options.ttlSeconds;

  const buildKey = (instanceId: string) => `${prefix}${instanceId}`;

  return {
    async load(instanceId) {
      const raw = await client.get(buildKey(instanceId));
      if (!raw) {
        return null;
      }

      return parseSessionData(raw);
    },
    async save(instanceId, data) {
      const value = prepareRedisValue(data);
      if (ttlSeconds && Number.isFinite(ttlSeconds)) {
        await client.set(buildKey(instanceId), value, { EX: ttlSeconds });
      } else {
        await client.set(buildKey(instanceId), value);
      }
    },
    async delete(instanceId) {
      await client.del(buildKey(instanceId));
    }
  };
};
