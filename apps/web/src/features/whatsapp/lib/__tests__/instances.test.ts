import { describe, expect, it } from 'vitest';

import { getStatusInfo, shouldDisplayInstance } from '../instances';

describe('instances status helpers', () => {
  it('prioritizes explicit connected flag when status is unknown', () => {
    const info = getStatusInfo({ status: 'synced', connected: true });
    expect(info).toEqual({
      label: 'Conectado',
      variant: 'success',
      status: 'connected',
      connected: true,
    });
  });

  it('maps pending and failed statuses to appropriate variants', () => {
    expect(getStatusInfo({ status: 'pending' })).toEqual({
      label: 'Pendente',
      variant: 'info',
      status: 'pending',
      connected: false,
    });
    expect(getStatusInfo({ status: 'failed' })).toEqual({
      label: 'Falhou',
      variant: 'destructive',
      status: 'failed',
      connected: false,
    });
  });

  it('falls back to disconnected when status is unknown and connection is false', () => {
    const info = getStatusInfo({ status: 'synced', connected: false });
    expect(info).toEqual({
      label: 'Desconectado',
      variant: 'secondary',
      status: 'disconnected',
      connected: false,
    });
  });

  it('treats reconnecting instances as visible and selectable candidates', () => {
    const info = getStatusInfo({ status: 'reconnecting' });
    expect(info).toEqual({
      label: 'Reconectando',
      variant: 'info',
      status: 'reconnecting',
      connected: false,
    });

    expect(shouldDisplayInstance({ status: 'reconnecting', connected: false })).toBe(true);
  });
});
