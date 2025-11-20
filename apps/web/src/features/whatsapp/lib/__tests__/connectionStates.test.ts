import { describe, expect, it } from 'vitest';

import { resolveConnectionState } from '../connectionStates.js';

describe('resolveConnectionState', () => {
  it('uses shared normalization when variant is missing', () => {
    expect(resolveConnectionState({ status: 'CONNECTED', connected: true })).toBe('connected');
  });

  it('maps QR-required states to reconnecting', () => {
    expect(resolveConnectionState({ status: 'qr_required', connected: false })).toBe('reconnecting');
  });

  it('falls back to disconnected when no input is provided', () => {
    expect(resolveConnectionState(undefined)).toBe('disconnected');
  });
});
