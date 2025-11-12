import type {
  InstancesStoreState,
  RealtimeEventEntry,
  RealtimeSlice,
} from './types';

export const createRealtimeSlice = (
  set: (
    partial:
      | Partial<InstancesStoreState>
      | ((state: InstancesStoreState) => Partial<InstancesStoreState>),
    replace?: boolean,
  ) => void,
  get: () => InstancesStoreState,
): RealtimeSlice => ({
  liveEvents: [],
  realtimeConnected: false,

  applyRealtimeEvent(event, limit = 30) {
    set((state) => {
      const next = [event, ...state.liveEvents];
      const seen = new Set<string>();
      const deduped: RealtimeEventEntry[] = [];
      for (const entry of next) {
        const key = `${entry.instanceId}-${entry.timestamp}-${entry.type}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        deduped.push(entry);
        if (deduped.length >= limit) {
          break;
        }
      }
      return { liveEvents: deduped };
    });
  },

  clearRealtimeEvents() {
    set({ liveEvents: [] });
  },

  setRealtimeConnected(value) {
    if (get().realtimeConnected === value) {
      return;
    }
    set({ realtimeConnected: value });
  },
});
