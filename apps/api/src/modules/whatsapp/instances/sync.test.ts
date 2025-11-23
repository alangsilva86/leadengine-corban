import { describe, expect, it, vi } from 'vitest';

import {
  appendInstanceHistory,
  buildHistoryEntry,
  findPhoneNumberInObject,
  pickString,
  withInstanceLastError,
} from './helpers';
import { mapBrokerInstanceStatusToDbStatus, mapBrokerStatusToDbStatus } from './status-mapper';
import { createSyncInstancesFromBroker } from './sync';
import { buildFallbackInstancesFromSnapshots } from './service';
import type { WhatsAppBrokerInstanceSnapshot } from '../../../services/whatsapp-broker-client';
import { whatsappBrokerClient } from '../../../services/whatsapp-broker-client';


const buildDeps = () => {
  const prisma = {
    whatsAppInstance: {
      update: vi.fn(),
      upsert: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
  };

  return {
    prisma: prisma as unknown as Parameters<typeof createSyncInstancesFromBroker>[0]['prisma'],
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    whatsappBrokerClient: {
      listInstances: vi.fn(),
    },
    emitToTenant: vi.fn(),
    readInstanceArchives: vi.fn().mockResolvedValue(new Map()),
    appendInstanceHistory,
    buildHistoryEntry,
    withInstanceLastError,
    findPhoneNumberInObject,
    pickString,
    mapBrokerStatusToDbStatus,
    mapBrokerInstanceStatusToDbStatus,
    metrics: {
      recordDiscardedSnapshot: vi.fn(),
    },
  } as const;
};

describe('createSyncInstancesFromBroker', () => {
  it('ignores snapshots from another tenant', async () => {
    const deps = buildDeps();
    const syncInstances = createSyncInstancesFromBroker(deps as any);
    const snapshots: WhatsAppBrokerInstanceSnapshot[] = [
      {
        instance: { id: 'instance-1', tenantId: 'other-tenant', status: 'connected', connected: true },
        status: { status: 'connected', connected: true },
      },
    ];

    const result = await syncInstances('tenant-123', [], snapshots);

    expect(result.snapshots).toHaveLength(0);
    expect(deps.readInstanceArchives).not.toHaveBeenCalled();
    expect(deps.prisma.whatsAppInstance.upsert).not.toHaveBeenCalled();
    expect(deps.prisma.whatsAppInstance.update).not.toHaveBeenCalled();
  });

  it('ignores snapshots without tenant information', async () => {
    const deps = buildDeps();
    const syncInstances = createSyncInstancesFromBroker(deps as any);
    const snapshots: WhatsAppBrokerInstanceSnapshot[] = [
      {
        instance: { id: 'instance-2', status: 'connected', connected: true } as any,
        status: { status: 'connected', connected: true },
      },
    ];

    const result = await syncInstances('tenant-abc', [], snapshots);

    expect(result.snapshots).toHaveLength(0);
    expect(deps.readInstanceArchives).not.toHaveBeenCalled();
    expect(deps.prisma.whatsAppInstance.upsert).not.toHaveBeenCalled();
    expect(deps.prisma.whatsAppInstance.update).not.toHaveBeenCalled();
  });

  it('uses the tenant from the snapshot when creating instances', async () => {
    const deps = buildDeps();
    const syncInstances = createSyncInstancesFromBroker(deps as any);
    const snapshots: WhatsAppBrokerInstanceSnapshot[] = [
      {
        instance: { id: 'instance-3', tenantId: 'tenant-xyz', status: 'connected', connected: true },
        status: { status: 'connected', connected: true },
      },
    ];

    await syncInstances('tenant-xyz', [], snapshots);

    expect(deps.prisma.whatsAppInstance.upsert).toHaveBeenCalledTimes(1);
    const upsertArgs = deps.prisma.whatsAppInstance.upsert.mock.calls[0][0];
    expect(upsertArgs.create.tenantId).toBe('tenant-xyz');
    expect(upsertArgs.update.tenantId).toBe('tenant-xyz');
  });

  it('discards untrusted snapshots without tenant markers or allowlist entries', async () => {
    const deps = buildDeps();
    const syncInstances = createSyncInstancesFromBroker(deps as any);
    const snapshots: WhatsAppBrokerInstanceSnapshot[] = [
      {
        instance: {
          id: 'rogue-instance',
          tenantId: 'tenant-rogue',
          status: 'connected',
          connected: true,
          metadata: {},
        } as any,
        status: { status: 'connected', connected: true },
      },
    ];

    await syncInstances('tenant-rogue', [], snapshots);

    expect(deps.prisma.whatsAppInstance.upsert).not.toHaveBeenCalled();
    expect(deps.prisma.whatsAppInstance.update).not.toHaveBeenCalled();
    expect(deps.metrics.recordDiscardedSnapshot).toHaveBeenCalledWith(
      'tenant-rogue',
      'untrusted-snapshot',
      'tenant-rogue',
      'rogue-instance'
    );
    expect(deps.logger.warn).toHaveBeenCalledWith('whatsapp.instances.sync.discardUntrustedSnapshot', expect.any(Object));
  });
});

describe('buildFallbackInstancesFromSnapshots', () => {
  it('omits snapshots whose tenantId is missing or does not match the requested tenant', () => {
    const snapshots: WhatsAppBrokerInstanceSnapshot[] = [
      {
        instance: { id: 'instance-1', tenantId: 'other-tenant', status: 'connected', connected: true },
        status: { status: 'connected', connected: true },
      },
      {
        instance: { id: 'instance-2', status: 'connected', connected: true } as any,
        status: { status: 'connected', connected: true },
      },
      {
        instance: {
          id: 'instance-3',
          metadata: { tenantId: 'tenant-123' },
          status: 'connected',
          connected: true,
        } as any,
        status: { status: 'connected', connected: true },
      },
    ];

    const result = buildFallbackInstancesFromSnapshots('tenant-123', snapshots);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('instance-3');
    expect(result[0].tenantId).toBe('tenant-123');
  });
});

describe('WhatsAppBrokerClient normalization', () => {
  it('preserves missing broker tenantId for downstream validation', () => {
    const instance = (whatsappBrokerClient as any).normalizeBrokerInstance('tenant-input', {
      id: 'instance-4',
      status: 'connected',
      connected: true,
    });

    expect(instance?.tenantId).toBe('');
  });
});
