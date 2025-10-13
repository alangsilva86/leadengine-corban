import { describe, expect, it, beforeEach, vi } from 'vitest';

vi.mock('@whiskeysockets/baileys', () => {
  const proto = {
    Message: {
      AppStateSyncKeyData: {
        fromObject: (value: unknown) => value,
        toObject: (value: unknown) => value
      }
    }
  };

  return {
    initAuthCreds: () => ({
      noiseKey: {
        private: Buffer.alloc(0),
        public: Buffer.alloc(0)
      }
    }),
    proto
  };
});
import { useSessionStoreAuthState } from '../store-auth-state';
import type { WhatsAppSessionData, WhatsAppSessionStore } from '../session-store';

class InMemorySessionStore implements WhatsAppSessionStore {
  private sessions = new Map<string, WhatsAppSessionData>();

  private clone<T>(value: T): T {
    const cloner = (globalThis as { structuredClone?: <U>(input: U) => U }).structuredClone;
    if (typeof cloner === 'function') {
      return cloner(value);
    }

    return JSON.parse(JSON.stringify(value)) as T;
  }

  async load(instanceId: string): Promise<WhatsAppSessionData | null> {
    const session = this.sessions.get(instanceId);
    if (!session) {
      return null;
    }

    return {
      creds: this.clone(session.creds),
      keys: this.clone(session.keys),
      updatedAt: new Date(session.updatedAt)
    };
  }

  async save(instanceId: string, data: WhatsAppSessionData): Promise<void> {
    this.sessions.set(instanceId, {
      creds: this.clone(data.creds),
      keys: this.clone(data.keys),
      updatedAt: new Date(data.updatedAt)
    });
  }

  async delete(instanceId: string): Promise<void> {
    this.sessions.delete(instanceId);
  }

  get size(): number {
    return this.sessions.size;
  }
}

describe('useSessionStoreAuthState', () => {
  let store: InMemorySessionStore;

  beforeEach(() => {
    store = new InMemorySessionStore();
  });

  it('persists credentials and keys across reloads', async () => {
    const firstState = await useSessionStoreAuthState('instance-1', store);

    firstState.state.creds.me = { id: 'bot@s.whatsapp.net' } as any;

    await firstState.state.keys.set({
      'sender-key': {
        sample: {
          keyData: Buffer.from('sender-key')
        }
      }
    } as any);

    await firstState.saveCreds();

    const reloadedState = await useSessionStoreAuthState('instance-1', store);
    const loadedKeys = await reloadedState.state.keys.get('sender-key', ['sample']);

    expect(reloadedState.state.creds.me?.id).toBe('bot@s.whatsapp.net');
    const storedKey = (loadedKeys.sample as any)?.keyData;
    expect(Buffer.from(storedKey).toString('utf8')).toBe('sender-key');
    expect(store.size).toBe(1);
  });

  it('clears persisted data via session store', async () => {
    const state = await useSessionStoreAuthState('instance-2', store);

    state.state.creds.me = { id: 'cleanup@s.whatsapp.net' } as any;
    await state.saveCreds();

    expect(store.size).toBe(1);

    await state.clear();

    expect(store.size).toBe(0);
    const loaded = await store.load('instance-2');
    expect(loaded).toBeNull();
  });
});
