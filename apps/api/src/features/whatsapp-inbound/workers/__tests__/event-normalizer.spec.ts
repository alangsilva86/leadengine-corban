import { describe, expect, it } from 'vitest';

import {
  normalizeBrokerEventEnvelope,
  normalizeCursorState,
} from '../event-normalizer';

describe('event-normalizer', () => {
  it('normalizes nested event envelopes with cursor metadata', () => {
    const envelope = normalizeBrokerEventEnvelope({
      id: 42,
      cursor: { cursor: 'cursor-42', instanceId: 'inst-42' },
      instanceId: 'inst-42',
      event: {
        type: 'MESSAGE_INBOUND',
        id: 'wamid-42',
        tenantId: 'tenant-x',
        payload: {},
      },
    });

    expect(envelope).not.toBeNull();
    expect(envelope?.ackId).toBe('42');
    expect(envelope?.cursor).toBe('cursor-42');
    expect(envelope?.instanceId).toBe('inst-42');
    expect(envelope?.event.id).toBe('wamid-42');
    expect(envelope?.event.instanceId).toBe('inst-42');
    expect(envelope?.event.cursor).toBe('cursor-42');
    expect(envelope?.event.sessionId).toBe('inst-42');
  });

  it('falls back to ack identifiers and cursor tokens when event id is missing', () => {
    const envelope = normalizeBrokerEventEnvelope({
      id: { scope: 'multi', value: 'ack-10' },
      cursor: { token: 987 },
      payload: {
        type: 'MESSAGE_INBOUND',
        tenantId: 'tenant-y',
      },
    });

    expect(envelope).not.toBeNull();
    expect(envelope?.ackId).toContain('ack-10');
    expect(envelope?.event.id).toBe(envelope?.ackId);
    expect(envelope?.cursor).toBe('987');
    expect(envelope?.event.cursor).toBe('987');
  });

  it('normalizes composite cursor state from JSON strings', () => {
    const state = normalizeCursorState('{"cursor":"abc","instanceId":"inst-55"}');
    expect(state.cursor).toBe('abc');
    expect(state.instanceId).toBe('inst-55');
  });
});
