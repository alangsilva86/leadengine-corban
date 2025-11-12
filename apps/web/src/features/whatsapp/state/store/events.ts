import type { EventHandler, EventKey, StoreEventMap, StoreEvents } from './types';

export const createEvents = (): StoreEvents => {
  const handlers = new Map<EventKey, Set<EventHandler<any>>>();

  return {
    on(event, handler) {
      const set = handlers.get(event) ?? new Set<EventHandler<any>>();
      set.add(handler);
      handlers.set(event, set);
      return () => {
        set.delete(handler);
      };
    },
    emit(event, payload) {
      const set = handlers.get(event);
      if (!set) {
        return;
      }
      for (const handler of Array.from(set)) {
        handler(payload);
      }
    },
  };
};
