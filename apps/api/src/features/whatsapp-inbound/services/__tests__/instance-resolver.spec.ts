import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findFirstMock } = vi.hoisted(() => ({
  findFirstMock: vi.fn(),
}));

vi.mock('../../../../lib/prisma', () => ({
  prisma: {
    whatsAppInstance: {
      findFirst: findFirstMock,
    },
  },
}));

vi.mock('../../../../config/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

import {
  resolveWhatsappInstanceByIdentifiers,
  __testing as instanceResolverTesting,
} from '../instance-resolver';

describe('resolveWhatsappInstanceByIdentifiers', () => {
  beforeEach(() => {
    findFirstMock.mockReset();
    instanceResolverTesting.resetCache();
  });

  it('returns null when identifiers are empty', async () => {
    const resolved = await resolveWhatsappInstanceByIdentifiers([null, undefined, '']);
    expect(resolved).toBeNull();
    expect(findFirstMock).not.toHaveBeenCalled();
  });

  it('queries prisma and caches the result for subsequent lookups', async () => {
    findFirstMock.mockResolvedValueOnce({
      id: 'instance-1',
      tenantId: 'tenant-42',
      brokerId: 'broker-123',
    });

    const firstResolution = await resolveWhatsappInstanceByIdentifiers(['broker-123']);
    expect(firstResolution).toEqual({
      instanceId: 'instance-1',
      tenantId: 'tenant-42',
      brokerId: 'broker-123',
    });
    expect(findFirstMock).toHaveBeenCalledTimes(1);

    findFirstMock.mockClear();
    const cachedResolution = await resolveWhatsappInstanceByIdentifiers(['broker-123']);
    expect(cachedResolution).toEqual({
      instanceId: 'instance-1',
      tenantId: 'tenant-42',
      brokerId: 'broker-123',
    });
    expect(findFirstMock).not.toHaveBeenCalled();
  });

  it('stores cache for both alias and broker identifiers', async () => {
    findFirstMock.mockResolvedValueOnce({
      id: 'instance-alias',
      tenantId: 'tenant-99',
      brokerId: 'broker-uuid',
    });

    const resolved = await resolveWhatsappInstanceByIdentifiers(['instance-alias']);
    expect(resolved).toEqual({
      instanceId: 'instance-alias',
      tenantId: 'tenant-99',
      brokerId: 'broker-uuid',
    });
    expect(findFirstMock).toHaveBeenCalledTimes(1);

    findFirstMock.mockClear();
    const cachedViaBroker = await resolveWhatsappInstanceByIdentifiers(['broker-uuid']);
    expect(cachedViaBroker).toEqual({
      instanceId: 'instance-alias',
      tenantId: 'tenant-99',
      brokerId: 'broker-uuid',
    });
    expect(findFirstMock).not.toHaveBeenCalled();
  });
});
