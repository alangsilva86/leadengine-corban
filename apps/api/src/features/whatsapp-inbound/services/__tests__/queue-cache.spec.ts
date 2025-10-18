import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ensureInboundQueueForInboundMessage,
  getDefaultQueueId,
  provisionDefaultQueueForTenant,
  queueCacheByTenant,
  reset,
} from '../queue-cache';

vi.mock('../../../../config/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  },
}));

vi.mock('../../../../lib/prisma', () => ({
  prisma: {
    queue: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock('../../../../services/tenant-service', () => ({
  ensureTenantRecord: vi.fn(),
}));

vi.mock('../../../../lib/socket-registry', () => ({
  emitToTenant: vi.fn(),
}));

describe('queue cache', () => {
  let prismaQueueFindFirstMock: ReturnType<typeof vi.fn>;
  let prismaQueueFindUniqueMock: ReturnType<typeof vi.fn>;
  let prismaQueueUpsertMock: ReturnType<typeof vi.fn>;
  let ensureTenantRecordMock: ReturnType<typeof vi.fn>;
  let emitToTenantMock: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    const prismaModule = await import('../../../../lib/prisma');
    const tenantModule = await import('../../../../services/tenant-service');
    const socketModule = await import('../../../../lib/socket-registry');

    prismaQueueFindFirstMock = prismaModule.prisma.queue.findFirst as unknown as ReturnType<typeof vi.fn>;
    prismaQueueFindUniqueMock = prismaModule.prisma.queue.findUnique as unknown as ReturnType<typeof vi.fn>;
    prismaQueueUpsertMock = prismaModule.prisma.queue.upsert as unknown as ReturnType<typeof vi.fn>;
    ensureTenantRecordMock = tenantModule.ensureTenantRecord as unknown as ReturnType<typeof vi.fn>;
    emitToTenantMock = socketModule.emitToTenant as unknown as ReturnType<typeof vi.fn>;
  });

  beforeEach(() => {
    reset();
    vi.clearAllMocks();
  });

  it('caches queue identifiers and validates cached entries', async () => {
    prismaQueueFindFirstMock.mockResolvedValueOnce({ id: 'queue-1' });
    prismaQueueFindUniqueMock.mockResolvedValueOnce({ id: 'queue-1' });

    const first = await getDefaultQueueId('tenant-cache');
    expect(first).toBe('queue-1');
    expect(queueCacheByTenant.get('tenant-cache')).toMatchObject({ id: 'queue-1' });

    await getDefaultQueueId('tenant-cache');
    expect(prismaQueueFindFirstMock).toHaveBeenCalledTimes(1);
    expect(prismaQueueFindUniqueMock).toHaveBeenCalledWith({ where: { id: 'queue-1' } });
  });

  it('purges stale cache entries and provisions queues when missing', async () => {
    const now = Date.now();
    queueCacheByTenant.set('tenant-new', { id: 'queue-stale', expires: now - 1 });

    prismaQueueFindFirstMock.mockResolvedValueOnce(null);
    prismaQueueUpsertMock.mockResolvedValueOnce({ id: 'queue-created', tenantId: 'tenant-new' });

    const queueId = await getDefaultQueueId('tenant-new');
    expect(queueId).toBe('queue-created');
    expect(queueCacheByTenant.get('tenant-new')?.id).toBe('queue-created');
    expect(prismaQueueUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId_name: expect.objectContaining({ tenantId: 'tenant-new' }) }),
      })
    );
  });

  it('ensures tenants when foreign key errors occur during provisioning', async () => {
    prismaQueueFindFirstMock.mockResolvedValueOnce(null);
    const fkError = Object.assign(new Error('Missing tenant'), { code: 'P2003' as const });
    prismaQueueUpsertMock.mockRejectedValueOnce(fkError).mockResolvedValueOnce({
      id: 'queue-after-tenant',
      tenantId: 'tenant-missing',
    });
    ensureTenantRecordMock.mockResolvedValueOnce({ id: 'tenant-missing' });

    const queueId = await provisionDefaultQueueForTenant('tenant-missing');

    expect(queueId).toBe('queue-after-tenant');
    expect(ensureTenantRecordMock).toHaveBeenCalledWith(
      'tenant-missing',
      expect.objectContaining({ source: 'whatsapp-inbound-auto-queue', action: 'ensure-tenant' })
    );
  });

  it('emits notifications when automatically provisioning queues', async () => {
    prismaQueueFindFirstMock.mockResolvedValueOnce(null);
    prismaQueueUpsertMock.mockResolvedValueOnce({ id: 'queue-auto', tenantId: 'tenant-auto' });

    const result = await ensureInboundQueueForInboundMessage({
      tenantId: 'tenant-auto',
      requestId: 'req-auto',
      instanceId: 'instance-auto',
      simpleMode: true,
    });

    expect(result).toEqual({ queueId: 'queue-auto', wasProvisioned: true });
    expect(emitToTenantMock).toHaveBeenCalledWith(
      'tenant-auto',
      'whatsapp.queue.autoProvisioned',
      expect.objectContaining({ queueId: 'queue-auto', instanceId: 'instance-auto' })
    );
  });

  it('returns recoverable errors when provisioning cannot ensure tenants', async () => {
    prismaQueueFindFirstMock.mockResolvedValueOnce(null);
    const fkError = Object.assign(new Error('Missing tenant'), { code: 'P2003' as const });
    prismaQueueUpsertMock.mockRejectedValueOnce(fkError).mockRejectedValueOnce(fkError);
    ensureTenantRecordMock.mockResolvedValueOnce({ id: 'tenant-missing' });

    const result = await ensureInboundQueueForInboundMessage({
      tenantId: 'tenant-missing',
      requestId: 'req-missing',
      instanceId: 'instance-missing',
      simpleMode: false,
    });

    expect(result.queueId).toBeNull();
    expect(result.wasProvisioned).toBe(false);
    expect(result.error).toEqual(expect.objectContaining({ reason: 'TENANT_NOT_FOUND', recoverable: true }));
    expect(emitToTenantMock).toHaveBeenCalledWith(
      'tenant-missing',
      'whatsapp.queue.missing',
      expect.objectContaining({ reason: 'TENANT_NOT_FOUND', recoverable: true })
    );
  });
});
