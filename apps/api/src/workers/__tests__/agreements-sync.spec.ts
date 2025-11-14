import { beforeEach, describe, expect, it, vi } from 'vitest';

const buildSettings = () => ({
  'atlas-promotora': {
    id: 'atlas-promotora',
    name: 'Atlas Promotora',
    enabled: true,
    deprecated: false,
    sunsetAt: null,
  },
  'aurora-bank': {
    id: 'aurora-bank',
    name: 'Aurora Bank',
    enabled: true,
    deprecated: false,
    sunsetAt: null,
  },
});

describe('agreements-sync worker', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('normalizes provider payloads and persists snapshot', async () => {
    const settingsById = buildSettings();
    const fetchAgreementsMock = vi.fn().mockResolvedValue([
      {
        agreement: {
          id: 'agr-1',
          name: 'Convênio Atlas',
          status: 'active',
          updatedAt: '2024-02-10T12:00:00.000Z',
        },
        rates: [
          {
            id: 'rate-1',
            type: 'consignado',
            value: 1.95,
            unit: 'percent',
            effectiveAt: '2024-02-01T00:00:00.000Z',
          },
        ],
        tables: [
          {
            id: 'table-1',
            product: 'consignado',
            termMonths: 84,
            coefficient: 0.0189,
            minValue: 1000,
            maxValue: 100000,
          },
        ],
      },
    ]);

    const saveSnapshotMock = vi.fn().mockResolvedValue(null);
    const loadSnapshotMock = vi.fn().mockResolvedValue(null);

    vi.mock('../../services/agreements-domain-service', () => ({
      agreementsDomainService: {
        saveAgreementSnapshot: saveSnapshotMock,
        loadAgreementSnapshot: loadSnapshotMock,
      },
    }));

    vi.mock('../../services/integrations/banks', () => ({
      bankIntegrationClients: new Map(),
      listBankIntegrationSettings: vi.fn(() => Object.values(settingsById)),
      getBankIntegrationSettings: vi.fn((id: keyof typeof settingsById) => settingsById[id]),
    }));

    const { runAgreementsSync } = await import('../agreements-sync');

    const mockClient = {
      settings: settingsById['atlas-promotora'],
      fetchAgreements: fetchAgreementsMock,
    } as any;

    const results = await runAgreementsSync(
      { providerId: 'atlas-promotora', traceId: 'trace-success' },
      { clients: new Map([[('atlas-promotora' as const), mockClient]]), now: () => new Date('2024-02-11T10:00:00.000Z') }
    );

    expect(fetchAgreementsMock).toHaveBeenCalledWith({ traceId: 'trace-success' });
    expect(saveSnapshotMock).toHaveBeenCalledWith(
      expect.objectContaining({
        providerId: 'atlas-promotora',
        agreements: [
          expect.objectContaining({
            externalId: 'agr-1',
            name: 'Convênio Atlas',
            status: 'active',
          }),
        ],
        rates: [
          expect.objectContaining({
            rateId: 'rate-1',
            value: 1.95,
            unit: 'percent',
          }),
        ],
        tables: [
          expect.objectContaining({
            tableId: 'table-1',
            termMonths: 84,
          }),
        ],
      })
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      providerId: 'atlas-promotora',
      status: 'succeeded',
      stats: expect.objectContaining({ agreements: 1, rates: 1, tables: 1, fallback: false }),
    });
  });

  it('opens circuit after consecutive failures and serves fallback snapshot', async () => {
    const settingsById = buildSettings();
    const fetchAgreementsMock = vi.fn().mockRejectedValue(new Error('timeout'));

    const fallbackSnapshot = {
      providerId: 'atlas-promotora',
      agreements: [
        {
          providerId: 'atlas-promotora',
          externalId: 'agr-legacy',
          name: 'Convênio Legado',
          status: 'active',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ],
      rates: [],
      tables: [],
      meta: { traceId: 'legacy', syncedAt: '2024-01-02T00:00:00.000Z' },
    };

    const saveSnapshotMock = vi.fn();
    const loadSnapshotMock = vi.fn().mockResolvedValue(fallbackSnapshot);

    vi.mock('../../services/agreements-domain-service', () => ({
      agreementsDomainService: {
        saveAgreementSnapshot: saveSnapshotMock,
        loadAgreementSnapshot: loadSnapshotMock,
      },
    }));

    vi.mock('../../services/integrations/banks', () => ({
      bankIntegrationClients: new Map(),
      listBankIntegrationSettings: vi.fn(() => Object.values(settingsById)),
      getBankIntegrationSettings: vi.fn((id: keyof typeof settingsById) => settingsById[id]),
    }));

    const { runAgreementsSync, __testing } = await import('../agreements-sync');

    const mockClient = {
      settings: settingsById['atlas-promotora'],
      fetchAgreements: fetchAgreementsMock,
    } as any;

    const dependencies = {
      clients: new Map([[('atlas-promotora' as const), mockClient]]),
      now: () => new Date('2024-03-01T10:00:00.000Z'),
    };

    await runAgreementsSync({ providerId: 'atlas-promotora', traceId: 'trace-1', force: true }, dependencies);
    await runAgreementsSync({ providerId: 'atlas-promotora', traceId: 'trace-2', force: true }, dependencies);
    await runAgreementsSync({ providerId: 'atlas-promotora', traceId: 'trace-3', force: true }, dependencies);

    const results = await runAgreementsSync({ providerId: 'atlas-promotora', traceId: 'trace-4' }, dependencies);

    expect(fetchAgreementsMock).toHaveBeenCalledTimes(3);
    expect(saveSnapshotMock).not.toHaveBeenCalled();
    expect(loadSnapshotMock).toHaveBeenCalled();

    expect(results[0]).toMatchObject({
      providerId: 'atlas-promotora',
      status: 'skipped',
      stats: expect.objectContaining({ fallback: true, agreements: 1 }),
      error: expect.objectContaining({ message: expect.stringContaining('circuito aberto') }),
    });

    expect(__testing.circuitBreakerStore.get('atlas-promotora')).toMatchObject({ failures: expect.any(Number) });
  });
});

