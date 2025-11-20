import { describe, expect, it } from 'vitest';
import {
  ensureArrayOfObjects,
  getStatusInfo,
  normalizeInstanceRecord,
  normalizeInstancesCollection,
  parseInstancesPayload,
  resolveInstanceStatus,
  shouldDisplayInstance,
} from '../instances.js';

const sampleInstance = {
  id: 'ABC123',
  status: 'CONNECTED',
  connected: false,
  metadata: {
    tenantId: 'tenant-1',
    phoneNumber: '+5511999999999',
  },
};

describe('WhatsApp instances helpers', () => {
  it('normalizes a raw instance entry merging metadata and resolving fields', () => {
    const raw = {
      instance_id: '  abc123  ',
      status: 'CONNECTING',
      connected: true,
      metadata: { name: 'Primary', connected: false },
      profile: { phoneNumber: '+5511987654321' },
    };

    const normalized = normalizeInstanceRecord(raw);

    expect(normalized).toMatchObject({
      id: 'abc123',
      displayId: 'abc123',
      status: 'connecting',
      connected: true,
      name: 'Primary',
      phoneNumber: '+5511987654321',
      metadata: expect.objectContaining({ name: 'Primary', phoneNumber: '+5511987654321' }),
    });
  });

  it('collects unique instances and preserves merge priority', () => {
    const list = [
      sampleInstance,
      { ...sampleInstance, metadata: { name: 'First' } },
      { ...sampleInstance, connected: true, status: 'connected' },
    ];

    const normalized = normalizeInstancesCollection(list);
    expect(normalized).toHaveLength(1);
    expect(normalized[0]).toMatchObject({
      id: 'ABC123',
      connected: true,
      status: 'connected',
      metadata: expect.objectContaining({ name: 'First', tenantId: 'tenant-1' }),
    });
  });

  it('filters by tenant when requested', () => {
    const list = [
      sampleInstance,
      { ...sampleInstance, id: 'DEF456', metadata: { tenantId: 'tenant-2' } },
    ];

    const normalized = normalizeInstancesCollection(list, {
      filterByTenant: true,
      allowedTenants: ['tenant-2'],
    });

    expect(normalized).toHaveLength(1);
    expect(normalized[0].id).toBe('DEF456');
  });

  it('parses payloads and extracts nested status and qr info', () => {
    const payload = {
      data: {
        instances: [sampleInstance],
        status: { status: 'connected', connected: true },
        qr: '1234',
      },
    };

    const parsed = parseInstancesPayload(payload);

    expect(parsed.instances).toHaveLength(2);
    expect(parsed.status).toBe('connected');
    expect(parsed.connected).toBe(true);
    expect(parsed.qr).toMatchObject({ qr: '1234', qrCode: '1234' });
  });

  it('resolves status from various instance shapes', () => {
    expect(resolveInstanceStatus({ status: 'connected' })).toBe('connected');
    expect(resolveInstanceStatus({ status: { current: 'connecting' } })).toBe('connecting');
    expect(resolveInstanceStatus({ status: { status: 'disconnected' } })).toBe('disconnected');
    expect(resolveInstanceStatus({})).toBeNull();
  });

  it('ensures array of objects sanitizes invalid entries', () => {
    const result = ensureArrayOfObjects([sampleInstance, null, 5, { id: 'B' }]);
    expect(result).toEqual([
      sampleInstance,
      { id: 'B' },
    ]);
  });

  it('normalizes resolved status to display correct info even when uppercase', () => {
    const info = getStatusInfo({ status: 'CONNECTED', connected: false });

    expect(info).toMatchObject({ label: 'Conectado', variant: 'success' });
  });

  it('uses normalized status when deciding visibility', () => {
    expect(shouldDisplayInstance({ status: 'RECONNECTING' })).toBe(true);
    expect(shouldDisplayInstance({ status: 'UNKNOWN' })).toBe(false);
  });
});
