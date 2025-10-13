import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  WhatsAppSessionData,
  WhatsAppSessionStore
} from '@ticketz/integrations';
import { loadBaileysModule } from '@ticketz/integrations';

type BufferJson = typeof import('@whiskeysockets/baileys').BufferJSON;

let bufferJsonPromise: Promise<BufferJson> | null = null;

const getBufferJson = async (): Promise<BufferJson> => {
  if (!bufferJsonPromise) {
    bufferJsonPromise = loadBaileysModule().then(module => module.BufferJSON);
  }

  return bufferJsonPromise;
};

const prepareJsonValue = (data: WhatsAppSessionData, bufferJson: BufferJson): Prisma.InputJsonValue => {
  return JSON.parse(
    JSON.stringify(
      {
        ...data,
        updatedAt: data.updatedAt.toISOString()
      },
      bufferJson.replacer
    )
  ) as Prisma.InputJsonValue;
};

const parseSessionData = (raw: string | Prisma.JsonValue, bufferJson: BufferJson): WhatsAppSessionData => {
  const stringified = typeof raw === 'string' ? raw : JSON.stringify(raw);
  const parsed = JSON.parse(stringified, bufferJson.reviver) as WhatsAppSessionData;
  return {
    ...parsed,
    updatedAt: new Date(parsed.updatedAt)
  };
};

export const createPrismaWhatsAppSessionStore = (client: PrismaClient): WhatsAppSessionStore => ({
  async load(instanceId) {
    const bufferJson = await getBufferJson();
    const record = await client.whatsAppSession.findUnique({
      where: { instanceId }
    });

    if (!record) {
      return null;
    }

    return parseSessionData(record.data, bufferJson);
  },
  async save(instanceId, data) {
    const bufferJson = await getBufferJson();
    await client.whatsAppSession.upsert({
      where: { instanceId },
      create: {
        instanceId,
        data: prepareJsonValue(data, bufferJson)
      },
      update: {
        data: prepareJsonValue(data, bufferJson)
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

const prepareRedisValue = (data: WhatsAppSessionData, bufferJson: BufferJson): string => {
  return JSON.stringify(
    {
      ...data,
      updatedAt: data.updatedAt.toISOString()
    },
    bufferJson.replacer
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
      const bufferJson = await getBufferJson();
      const raw = await client.get(buildKey(instanceId));
      if (!raw) {
        return null;
      }

      return parseSessionData(raw, bufferJson);
    },
    async save(instanceId, data) {
      const bufferJson = await getBufferJson();
      const value = prepareRedisValue(data, bufferJson);
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
