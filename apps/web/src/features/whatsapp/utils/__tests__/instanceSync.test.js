import { describe, expect, it } from 'vitest';
import {
  buildTimelineEntries,
  deriveStatusFromSources,
  reduceRealtimeEvents,
  reconcileInstancesState,
  resolveFriendlyError,
  selectPreferredInstance,
} from '../instanceSync.js';

const makeInstance = (overrides = {}) => ({
  id: overrides.id ?? 'inst-1',
  status: overrides.status ?? 'connected',
  connected: overrides.connected ?? true,
  metadata: overrides.metadata ?? {},
  ...overrides,
});

describe('instanceSync utils', () => {
  describe('selectPreferredInstance', () => {
    it('prioritises preferred instance id when available', () => {
      const list = [makeInstance({ id: 'a' }), makeInstance({ id: 'b' })];
      expect(selectPreferredInstance(list, { preferredInstanceId: 'b' })?.id).toBe('b');
    });

    it('falls back to connected instance when no preference is provided', () => {
      const list = [makeInstance({ id: 'a', connected: false }), makeInstance({ id: 'b', connected: true })];
      expect(selectPreferredInstance(list)?.id).toBe('b');
    });
  });

  describe('reconcileInstancesState', () => {
    it('merges updates and derives status from payload', () => {
      const existing = [makeInstance({ id: 'a', status: 'connecting', connected: false })];
      const updates = {
        instance: { id: 'a', status: 'connected', connected: true },
        status: 'connected',
      };
      const result = reconcileInstancesState(existing, updates, {});
      expect(result.instances).toHaveLength(1);
      expect(result.instances[0].status).toBe('connected');
      expect(result.status).toBe('connected');
    });

    it('keeps instance order when merging new entries', () => {
      const existing = [makeInstance({ id: 'a' })];
      const updates = {
        instances: [makeInstance({ id: 'b', connected: false, status: 'disconnected' })],
        status: 'connected',
      };
      const result = reconcileInstancesState(existing, updates, {
        campaignInstanceId: 'b',
      });
      expect(result.instances.map((item) => item.id)).toEqual(['a', 'b']);
      expect(result.current?.id).toBe('b');
    });
  });

  describe('reduceRealtimeEvents', () => {
    it('deduplicates events and respects limit', () => {
      const event = {
        type: 'updated',
        payload: { id: 'a', status: 'connected', timestamp: '2024-01-01T00:00:00Z' },
      };
      const next = reduceRealtimeEvents([], event, 1);
      const repeated = reduceRealtimeEvents(next, event, 1);
      expect(next).toHaveLength(1);
      expect(repeated).toHaveLength(1);
      expect(repeated[0].instanceId).toBe('a');
    });
  });

  describe('buildTimelineEntries', () => {
    it('includes history entries sorted by timestamp', () => {
      const instance = makeInstance({
        metadata: {
          history: [
            { action: 'synced', timestamp: '2024-01-02T00:00:00Z' },
            { action: 'connected', timestamp: '2024-01-03T00:00:00Z' },
          ],
        },
      });
      const live = [
        {
          id: 'live-1',
          instanceId: instance.id,
          type: 'live',
          status: 'connecting',
          timestamp: '2024-01-04T00:00:00Z',
        },
      ];
      const timeline = buildTimelineEntries(instance, live);
      expect(timeline).toHaveLength(3);
      expect(timeline[0].timestamp).toBe('2024-01-04T00:00:00Z');
      expect(timeline[1].timestamp).toBe('2024-01-03T00:00:00Z');
    });
  });

  describe('resolveFriendlyError', () => {
    it('maps error payload to copy fields', () => {
      const resolveCopy = (code) => ({
        code: code ?? 'GENERIC',
        title: 'Oops',
        description: 'Resolved message',
      });
      const friendly = resolveFriendlyError(resolveCopy, {
        payload: { error: { code: 'E123', message: 'Raw error' } },
      });
      expect(friendly).toEqual({ code: 'E123', title: 'Oops', message: 'Resolved message' });
    });

    it('falls back to provided message when copy resolver has no description', () => {
      const resolveCopy = () => ({ code: 'GENERIC', title: 'Oops' });
      const friendly = resolveFriendlyError(resolveCopy, new Error('Boom'), 'Fallback');
      expect(friendly.message).toBe('Boom');
    });
  });

  describe('deriveStatusFromSources', () => {
    it('prefers explicit status over connected flag', () => {
      expect(
        deriveStatusFromSources({ explicitStatus: 'connecting', explicitConnected: true })
      ).toBe('connecting');
    });
  });
});
