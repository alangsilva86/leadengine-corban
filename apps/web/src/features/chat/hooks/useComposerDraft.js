import { useCallback, useSyncExternalStore } from 'react';

/**
 * Rascunhos do composer por conversa, guardados no sessionStorage.
 * Cada conversa tem o seu rascunho: trocar de conversa nunca leva o texto junto.
 */
const STORAGE_PREFIX = 'inbox:draft:';
const listeners = new Set();
const memoryFallback = new Map();

const storageKey = (ticketId) => `${STORAGE_PREFIX}${ticketId}`;

const getStorage = () => {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return window.sessionStorage;
    }
  } catch {
    // sessionStorage bloqueado (modo privado, iframes): usamos memória.
  }
  return null;
};

const readDraft = (ticketId) => {
  if (!ticketId) return '';
  const key = storageKey(ticketId);
  const storage = getStorage();
  if (storage) {
    try {
      return storage.getItem(key) ?? '';
    } catch {
      return memoryFallback.get(key) ?? '';
    }
  }
  return memoryFallback.get(key) ?? '';
};

const notify = (ticketId) => {
  listeners.forEach((listener) => listener(ticketId));
};

const writeDraft = (ticketId, value) => {
  if (!ticketId) return;
  const key = storageKey(ticketId);
  const normalized = typeof value === 'string' ? value : '';
  const previous = readDraft(ticketId);
  if (previous === normalized) return;
  const storage = getStorage();
  try {
    if (normalized.trim().length === 0) {
      storage?.removeItem(key);
      memoryFallback.delete(key);
    } else {
      storage?.setItem(key, normalized);
      if (!storage) memoryFallback.set(key, normalized);
    }
  } catch {
    if (normalized.trim().length === 0) {
      memoryFallback.delete(key);
    } else {
      memoryFallback.set(key, normalized);
    }
  }
  notify(ticketId);
};

const clearDraft = (ticketId) => writeDraft(ticketId, '');

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Lê (e acompanha) o rascunho de uma conversa — usado na lista para mostrar "Rascunho: …". */
export const useDraftPreview = (ticketId) =>
  useSyncExternalStore(
    subscribe,
    () => readDraft(ticketId),
    () => '',
  );

/**
 * Estado do rascunho de uma conversa. `setDraft` persiste na hora; `clear` apaga após o envio.
 */
export const useComposerDraft = (ticketId) => {
  const draft = useDraftPreview(ticketId);
  const setDraft = useCallback((value) => writeDraft(ticketId, value), [ticketId]);
  const clear = useCallback(() => clearDraft(ticketId), [ticketId]);
  return { draft, setDraft, clear };
};

export default useComposerDraft;
