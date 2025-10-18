import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Campaign } from '@prisma/client';
import type { InboundWhatsAppEvent } from '../inbound-lead-service';

const loggerStub = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
const maskPhoneStub = vi.fn((value: string | null | undefined) => (value ? `masked:${value}` : null));
const addAllocationsStub = vi.fn();
const emitToTenantStub = vi.fn();
const emitToAgreementStub = vi.fn();

vi.mock('../../../../config/logger', () => ({
  logger: loggerStub,
}));

vi.mock('../../../../lib/pii', () => ({
  maskPhone: maskPhoneStub,
}));

vi.mock('../../../../data/lead-allocation-store', () => ({
  addAllocations: addAllocationsStub,
}));

vi.mock('../../../../lib/socket-registry', () => ({
  emitToTenant: emitToTenantStub,
  emitToAgreement: emitToAgreementStub,
}));

type Contact = InboundWhatsAppEvent['contact'];
type Message = InboundWhatsAppEvent['message'];

const baseContact = { phone: '+5511999999999', name: 'Cliente WhatsApp' } as Contact;
const baseMessage = { id: 'message-1', text: 'Olá', type: 'TEXT', metadata: { broker: 'legacy' } } as Message;

let buildAllocationTargets: typeof import('../allocation-service')['buildAllocationTargets'];
let processAllocationTargets: typeof import('../allocation-service')['processAllocationTargets'];

beforeAll(async () => {
  const module = await import('../allocation-service');
  buildAllocationTargets = module.buildAllocationTargets;
  processAllocationTargets = module.processAllocationTargets;
});

const createDependencies = () => {
  const shouldSkipByDedupe = vi.fn(async () => false);
  const registerDedupeKey = vi.fn(async () => {});
  const mapErrorForLog = vi.fn((error: unknown) => error);
  const isUniqueViolation = vi.fn(() => false);
  const addAllocationsMock = vi
    .fn(async () => ({ newlyAllocated: [], summary: { total: 0, contacted: 0, won: 0, lost: 0 } }))
    .mockName('addAllocations');
  const emitToTenant = vi.fn();
  const emitToAgreement = vi.fn();
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  const maskPhone = vi.fn((value: string | null | undefined) => (value ? `masked:${value}` : null));

  const dependencies: Parameters<typeof processAllocationTargets>[1] = {
    shouldSkipByDedupe,
    registerDedupeKey,
    mapErrorForLog,
    isUniqueViolation,
    addAllocations: addAllocationsMock as unknown as NonNullable<Parameters<typeof processAllocationTargets>[1]['addAllocations']>,
    emitToTenant,
    emitToAgreement,
    logger,
    maskPhone,
  };

  return {
    dependencies,
    shouldSkipByDedupe,
    registerDedupeKey,
    mapErrorForLog,
    isUniqueViolation,
    addAllocationsMock,
    emitToTenant,
    emitToAgreement,
    logger,
    maskPhone,
  };
};

let dependencyBundle = createDependencies();

beforeEach(() => {
  dependencyBundle = createDependencies();
});

describe('buildAllocationTargets', () => {
  it('returns a fallback target when no campaigns are provided', () => {
    const targets = buildAllocationTargets({ campaigns: [], instanceId: 'instance-1' });

    expect(targets).toEqual([{ campaign: null, target: { instanceId: 'instance-1' } }]);
  });

  it('maps campaigns into allocation targets with instance context', () => {
    const campaigns = [
      { id: 'campaign-1', agreementId: 'agreement-1' },
      { id: 'campaign-2', agreementId: 'agreement-2' },
    ] as unknown as Campaign[];

    const targets = buildAllocationTargets({ campaigns, instanceId: 'instance-1' });

    expect(targets).toHaveLength(2);
    expect(targets[0]).toMatchObject({ campaign: campaigns[0], target: { campaignId: 'campaign-1', instanceId: 'instance-1' } });
    expect(targets[1]).toMatchObject({ campaign: campaigns[1], target: { campaignId: 'campaign-2', instanceId: 'instance-1' } });
  });
});

const baseProcessArgs = {
  tenantId: 'tenant-1',
  instanceId: 'instance-1',
  leadIdBase: 'lead-base',
  document: '12345678900',
  normalizedPhone: '+5511999999999',
  leadName: 'Cliente WhatsApp',
  registrations: ['client-123'],
  contact: baseContact,
  message: baseMessage,
  metadata: { source: 'broker' },
  timestamp: '2024-05-10T12:00:00.000Z',
  requestId: 'req-1',
  now: 1710000000000,
  dedupeTtlMs: 86_400_000,
};

describe('processAllocationTargets', () => {
  it('skips allocations when dedupe indicates recent handling for the campaign', async () => {
    const campaigns = [{ id: 'campaign-1', agreementId: 'agreement-1' }] as unknown as Campaign[];
    const allocationTargets = buildAllocationTargets({ campaigns, instanceId: 'instance-1' });

    dependencyBundle.shouldSkipByDedupe.mockResolvedValueOnce(true);

    await processAllocationTargets(
      {
        ...baseProcessArgs,
        allocationTargets,
      },
      dependencyBundle.dependencies
    );

    expect(dependencyBundle.shouldSkipByDedupe).toHaveBeenCalledWith('tenant-1:campaign-1:12345678900', baseProcessArgs.now);
    expect(dependencyBundle.addAllocationsMock).not.toHaveBeenCalled();
    expect(dependencyBundle.registerDedupeKey).not.toHaveBeenCalled();
  });

  it('registers dedupe keys and emits realtime updates on successful allocation', async () => {
    const allocationTargets = buildAllocationTargets({ campaigns: [], instanceId: 'instance-1' });
    dependencyBundle.addAllocationsMock.mockResolvedValueOnce({
      newlyAllocated: [
        {
          allocationId: 'alloc-1',
          leadId: 'lead-1',
          campaignId: null,
          agreementId: 'agreement-1',
          instanceId: 'instance-1',
        },
      ],
      summary: { total: 1, contacted: 0, won: 0, lost: 0 },
    });

    await processAllocationTargets(
      {
        ...baseProcessArgs,
        document: null,
        normalizedPhone: null,
        allocationTargets,
      },
      dependencyBundle.dependencies
    );

    expect(dependencyBundle.addAllocationsMock).toHaveBeenCalledWith(
      'tenant-1',
      allocationTargets[0]?.target,
      expect.any(Array)
    );
    expect(dependencyBundle.registerDedupeKey).toHaveBeenCalledWith('tenant-1:instance-1:lead-base', baseProcessArgs.now, baseProcessArgs.dedupeTtlMs);
    expect(dependencyBundle.emitToTenant).toHaveBeenCalledWith(
      'tenant-1',
      'leadAllocations.new',
      expect.objectContaining({
        allocation: expect.objectContaining({ allocationId: 'alloc-1' }),
        summary: expect.objectContaining({ total: 1 }),
      })
    );
    expect(dependencyBundle.emitToAgreement).toHaveBeenCalledWith(
      'agreement-1',
      'leadAllocations.new',
      expect.objectContaining({ allocation: expect.objectContaining({ allocationId: 'alloc-1' }) })
    );
    expect(dependencyBundle.logger.info).toHaveBeenCalled();
  });

  it('registers dedupe keys but suppresses hard failures on unique violations', async () => {
    const campaigns = [{ id: 'campaign-1', agreementId: 'agreement-1' }] as unknown as Campaign[];
    const allocationTargets = buildAllocationTargets({ campaigns, instanceId: 'instance-1' });
    const uniqueViolation = { duplicate: true };

    dependencyBundle.addAllocationsMock.mockRejectedValueOnce(uniqueViolation);
    dependencyBundle.isUniqueViolation.mockImplementation((error) => error === uniqueViolation);

    await expect(
      processAllocationTargets(
        {
          ...baseProcessArgs,
          allocationTargets,
        },
        dependencyBundle.dependencies
      )
    ).resolves.toBeUndefined();

    expect(dependencyBundle.registerDedupeKey).toHaveBeenCalledWith(
      'tenant-1:campaign-1:12345678900',
      baseProcessArgs.now,
      baseProcessArgs.dedupeTtlMs
    );
    expect(dependencyBundle.logger.debug).toHaveBeenCalled();
    expect(dependencyBundle.logger.error).not.toHaveBeenCalled();
  });

  it('emits tenant realtime updates but skips agreement notifications when the identifier is unknown', async () => {
    const allocationTargets = buildAllocationTargets({ campaigns: [], instanceId: 'instance-1' });

    dependencyBundle.addAllocationsMock.mockResolvedValueOnce({
      newlyAllocated: [
        {
          allocationId: 'alloc-2',
          leadId: 'lead-2',
          campaignId: null,
          agreementId: 'unknown',
          instanceId: 'instance-1',
        },
      ],
      summary: { total: 1, contacted: 0, won: 0, lost: 0 },
    });

    await processAllocationTargets(
      {
        ...baseProcessArgs,
        allocationTargets,
      },
      dependencyBundle.dependencies
    );

    expect(dependencyBundle.emitToTenant).toHaveBeenCalledWith(
      'tenant-1',
      'leadAllocations.new',
      expect.objectContaining({ allocation: expect.objectContaining({ allocationId: 'alloc-2' }) })
    );
    expect(dependencyBundle.emitToAgreement).not.toHaveBeenCalled();
  });
});
