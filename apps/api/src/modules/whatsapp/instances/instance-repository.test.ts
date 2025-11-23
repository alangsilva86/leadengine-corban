import { describe, expect, it, vi } from 'vitest';

vi.mock('@ticketz/storage', () => ({
  ensureTicketStageSupport: vi.fn(),
  setPrismaClient: vi.fn(),
}));

import { createPrismaInstanceRepository } from './instance-repository';
import { logger } from '../../../config/logger';

describe('createPrismaInstanceRepository.updatePhoneNumber', () => {
  it('updates the phone number scoped by tenant', async () => {
    const update = vi.fn().mockResolvedValue({});
    const repository = createPrismaInstanceRepository({
      whatsAppInstance: { update },
    } as any);

    await repository.updatePhoneNumber('tenant-1', 'instance-1', '+551199999999');

    expect(update).toHaveBeenCalledWith({
      where: { id: 'instance-1', tenantId: 'tenant-1' },
      data: { phoneNumber: '+551199999999' },
    });
  });

  it('fails when the instance is not found for the tenant', async () => {
    const error = Object.assign(new Error('Not found'), {
      code: 'P2025',
      clientVersion: '5.22.0',
    });
    const update = vi.fn().mockRejectedValue(error);
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);

    const repository = createPrismaInstanceRepository({
      whatsAppInstance: { update },
    } as any);

    await expect(
      repository.updatePhoneNumber('tenant-2', 'instance-2', '+551188888888')
    ).rejects.toBe(error);

    expect(warnSpy).toHaveBeenCalledWith(
      'whatsapp.instances.repository.updatePhoneNumber.notFound',
      {
        tenantId: 'tenant-2',
        instanceId: 'instance-2',
      }
    );

    warnSpy.mockRestore();
  });
});
