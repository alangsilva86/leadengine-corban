import { describe, it, expect, vi } from 'vitest';

import { appendInstanceHistory, buildHistoryEntry, findPhoneNumberInObject, pickString, withInstanceLastError } from './helpers';
import { mapBrokerInstanceStatusToDbStatus, mapBrokerStatusToDbStatus } from './status-mapper';
import { createSyncInstancesFromBroker } from './sync';
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
});

describe('WhatsAppBrokerClient normalization', () => {
  it('does not fallback missing broker tenantId to the requested tenant', () => {
    const instance = (whatsappBrokerClient as any).normalizeBrokerInstance('tenant-input', {
      id: 'instance-4',
      status: 'connected',
      connected: true,
    });

    expect(instance?.tenantId).toBe('');
  });
});
