import type { AuthenticationState } from '@whiskeysockets/baileys';
import { loadBaileysModule, type BaileysModule } from './baileys-loader';
import type { WhatsAppSessionAuthState, WhatsAppSessionData, WhatsAppSessionKeyMap, WhatsAppSessionStore } from './session-store';

type StoredSession = WhatsAppSessionData & { keys: WhatsAppSessionKeyMap };

let protoModulePromise: Promise<BaileysModule['proto']> | null = null;

const loadProto = async (): Promise<BaileysModule['proto']> => {
  if (!protoModulePromise) {
    protoModulePromise = loadBaileysModule().then(module => module.proto);
  }

  return protoModulePromise;
};

const normalizeSession = (session: WhatsAppSessionData | null, baileys: BaileysModule): StoredSession => {
  if (!session) {
    return {
      creds: baileys.initAuthCreds(),
      keys: {},
      updatedAt: new Date()
    };
  }

  return {
    creds: session.creds,
    keys: session.keys ?? {},
    updatedAt: session.updatedAt ?? new Date()
  };
};

export const useSessionStoreAuthState = async (
  instanceId: string,
  store: WhatsAppSessionStore
): Promise<WhatsAppSessionAuthState> => {
  const baileys = await loadBaileysModule();
  const loaded = await store.load(instanceId);
  const session = normalizeSession(loaded, baileys);

  const persist = async () => {
    const payload: WhatsAppSessionData = {
      creds: session.creds,
      keys: session.keys,
      updatedAt: new Date()
    };

    session.updatedAt = payload.updatedAt;
    await store.save(instanceId, payload);
  };

  const state: AuthenticationState = {
    creds: session.creds,
    keys: {
      get: async (type, ids) => {
        const data: { [key: string]: any } = {};
        for (const id of ids) {
          const category = (session.keys[type] ?? {}) as Record<string, unknown>;
          let value = category[id];
          if (type === 'app-state-sync-key' && value) {
            const proto = await loadProto();
            value = proto.Message.AppStateSyncKeyData.fromObject(value as any);
          }
          data[id] = value;
        }

        return data;
      },
      set: async data => {
        const updates = data as unknown as Record<string, Record<string, unknown>>;

        for (const category of Object.keys(updates)) {
          session.keys[category] = session.keys[category] ?? {};
          const categoryData = session.keys[category]! as Record<string, unknown>;

          for (const id of Object.keys(updates[category] ?? {})) {
            const value = updates[category]?.[id];
            if (value) {
              if (category === 'app-state-sync-key' && value) {
                const proto = await loadProto();
                categoryData[id] = proto.Message.AppStateSyncKeyData.toObject(value as any);
              } else {
                categoryData[id] = value;
              }
            } else {
              delete categoryData[id];
            }
          }

          if (Object.keys(categoryData).length === 0) {
            delete session.keys[category];
          }
        }

        await persist();
      }
    }
  };

  const saveCreds = async () => {
    await persist();
  };

  const clear = async () => {
    await store.delete(instanceId);
  };

  return { state, saveCreds, clear };
};
