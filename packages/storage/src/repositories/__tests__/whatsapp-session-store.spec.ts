import { describe, expect, it, beforeEach, vi } from 'vitest';

vi.mock('@whiskeysockets/baileys', () => ({
  BufferJSON: {
    replacer: (_key: string, value: unknown) => {
      if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
        return {
          __type: 'Buffer',
          data: Array.from(Buffer.from(value))
        };
      }
      return value;
    },
    reviver: (_key: string, value: unknown) => {
      if (value && typeof value === 'object' && (value as any).__type === 'Buffer') {
        return Buffer.from((value as any).data);
      }
      return value;
    }
  }
}));
import { createPrismaWhatsAppSessionStore, createRedisWhatsAppSessionStore } from '../whatsapp-session-store';
import type { WhatsAppSessionData } from '@ticketz/integrations';

const createSampleSession = (): WhatsAppSessionData => ({
  creds: {
    noiseKey: {
      private: Buffer.from('noise-private'),
      public: Buffer.from('noise-public')
    }
  } as any,
  keys: {
    'sender-key': {
      sample: {
        keyData: Buffer.from('sender-key-data')
      }
    }
  } as any,
  updatedAt: new Date()
});

class InMemoryPrismaClient {
  private store = new Map<string, { instanceId: string; data: unknown }>();

  whatsAppSession = {
    findUnique: async ({ where: { instanceId } }: { where: { instanceId: string } }) => {
      return this.store.get(instanceId) ?? null;
    },
    upsert: async ({
      where: { instanceId },
      create,
      update
    }: {
      where: { instanceId: string };
      create: { instanceId: string; data: unknown };
      update: { data: unknown };
    }) => {
      const payload = this.store.has(instanceId) ? { instanceId, data: update.data } : create;
      this.store.set(instanceId, payload);
      return payload;
    },
    delete: async ({ where: { instanceId } }: { where: { instanceId: string } }) => {
      const existing = this.store.get(instanceId);
      if (!existing) {
        throw Object.assign(new Error('Not found'), { code: 'P2025' });
      }
      this.store.delete(instanceId);
      return existing;
    }
  };
}

class MockRedisClient {
  data = new Map<string, string>();
  lastSetOptions: Record<string, unknown> | undefined;

  async get(key: string): Promise<string | null> {
    return this.data.get(key) ?? null;
  }

  async set(key: string, value: string, options?: Record<string, unknown>): Promise<void> {
    this.data.set(key, value);
    this.lastSetOptions = options;
  }

  async del(key: string): Promise<void> {
    this.data.delete(key);
  }
}

describe('createPrismaWhatsAppSessionStore', () => {
  let prisma: InMemoryPrismaClient;

  beforeEach(() => {
    prisma = new InMemoryPrismaClient();
  });

  it('persists and retrieves sessions', async () => {
    const store = createPrismaWhatsAppSessionStore(prisma as any);
    const session = createSampleSession();

    await store.save('instance-1', session);

    const loaded = await store.load('instance-1');
    expect(loaded).not.toBeNull();
    expect(loaded?.keys['sender-key']?.sample).toBeDefined();
    expect(loaded?.updatedAt).toBeInstanceOf(Date);
  });

  it('handles deletions gracefully when session is missing', async () => {
    const store = createPrismaWhatsAppSessionStore(prisma as any);
    await expect(store.delete('missing-instance')).resolves.toBeUndefined();
  });
});

describe('createRedisWhatsAppSessionStore', () => {
  let redis: MockRedisClient;

  beforeEach(() => {
    redis = new MockRedisClient();
  });

  it('stores payloads with optional ttl', async () => {
    const store = createRedisWhatsAppSessionStore(redis, { ttlSeconds: 120 });
    const session = createSampleSession();

    await store.save('instance-1', session);

    expect(redis.lastSetOptions).toEqual({ EX: 120 });

    const loaded = await store.load('instance-1');
    expect(loaded?.creds.noiseKey?.private).toBeDefined();
  });

  it('deletes redis keys', async () => {
    const store = createRedisWhatsAppSessionStore(redis);
    const session = createSampleSession();

    await store.save('instance-2', session);
    await store.delete('instance-2');

    const loaded = await store.load('instance-2');
    expect(loaded).toBeNull();
  });
});
