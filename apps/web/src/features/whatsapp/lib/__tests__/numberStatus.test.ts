import { describe, expect, it } from 'vitest';

import { NUMBER_STATUS_KEYS, getNumberStatus } from '../numberStatus';

describe('getNumberStatus', () => {
  it.each([
    [{ status: 'connected', connected: true }, 'connected', 'Conectado', 'success', 'Ver detalhes'],
    [{ status: 'connecting' }, 'connecting', 'Conectando…', 'info', null],
    [{ status: 'reconnecting' }, 'connecting', 'Conectando…', 'info', null],
    [{ status: 'qr_required' }, 'pairing', 'Aguardando pareamento', 'warning', 'Conectar'],
    [{ status: 'pending' }, 'pairing', 'Aguardando pareamento', 'warning', 'Conectar'],
    [{ status: 'disconnected' }, 'disconnected', 'Desconectado', 'neutral', 'Reconectar'],
    [{ status: 'failed' }, 'error', 'Erro de conexão', 'danger', 'Tentar novamente'],
    [{ status: 'error' }, 'error', 'Erro de conexão', 'danger', 'Tentar novamente'],
  ])('maps %o to %s', (instance, key, label, tone, actionLabel) => {
    const status = getNumberStatus(instance);
    expect(status).toMatchObject({ key, label, tone, actionLabel });
  });

  it('marks an expired QR as "QR expirado" with a regenerate action', () => {
    expect(getNumberStatus({ status: 'qr_required' }, { qrExpired: true })).toMatchObject({
      key: 'qr_expired',
      label: 'QR expirado',
      actionLabel: 'Gerar novo QR',
    });
    expect(getNumberStatus({ status: 'qr_required', qr: { reason: 'expired' } }).key).toBe('qr_expired');
  });

  it('never exposes unknown raw statuses', () => {
    const status = getNumberStatus({ status: 'SESSION_WEIRD_STATE' });
    expect(status.label).toBe('Desconectado');
    expect(NUMBER_STATUS_KEYS).toContain(status.key);
  });

  it('trusts the explicit connected flag', () => {
    expect(getNumberStatus({ status: 'disconnected', connected: true }).key).toBe('connected');
  });

  it('flags statuses that need attention', () => {
    expect(getNumberStatus({ status: 'connected', connected: true }).needsAttention).toBe(false);
    expect(getNumberStatus({ status: 'connecting' }).needsAttention).toBe(false);
    expect(getNumberStatus({ status: 'disconnected' }).needsAttention).toBe(true);
  });
});
