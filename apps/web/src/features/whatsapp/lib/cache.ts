import sessionStorageAvailable from '@/lib/session-storage.js';

const INSTANCES_CACHE_KEY = 'leadengine:whatsapp:instances';
const INSTANCES_CACHE_VERSION = 2;

export interface InstancesCacheEntry {
  schemaVersion: number;
  list: unknown[];
  currentId: string | null;
  updatedAt: number;
}

export const readInstancesCache = (): InstancesCacheEntry | null => {
  if (!sessionStorageAvailable()) {
    return null;
  }

  try {
    const raw = sessionStorage.getItem(INSTANCES_CACHE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as InstancesCacheEntry | null;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const version =
      typeof parsed.schemaVersion === 'number'
        ? parsed.schemaVersion
        : typeof (parsed as any).version === 'number'
          ? (parsed as any).version
          : null;

    if (version !== INSTANCES_CACHE_VERSION) {
      sessionStorage.removeItem(INSTANCES_CACHE_KEY);
      return null;
    }

    return parsed;
  } catch (error) {
    console.warn('Não foi possível ler o cache de instâncias WhatsApp', error);
    return null;
  }
};

export const persistInstancesCache = (list: unknown[], currentId: string | null): void => {
  if (!sessionStorageAvailable()) {
    return;
  }

  try {
    sessionStorage.setItem(
      INSTANCES_CACHE_KEY,
      JSON.stringify({
        schemaVersion: INSTANCES_CACHE_VERSION,
        list,
        currentId,
        updatedAt: Date.now(),
      }),
    );
  } catch (error) {
    console.warn('Não foi possível armazenar o cache de instâncias WhatsApp', error);
  }
};

export const clearInstancesCache = (): void => {
  if (!sessionStorageAvailable()) {
    return;
  }
  sessionStorage.removeItem(INSTANCES_CACHE_KEY);
};

export const cacheConstants = {
  INSTANCES_CACHE_KEY,
  INSTANCES_CACHE_VERSION,
};
