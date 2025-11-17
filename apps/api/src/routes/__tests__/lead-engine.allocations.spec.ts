import express from 'express';
import request from 'supertest';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const listAllocationsMock = vi.fn();
const addAllocationsMock = vi.fn();
const updateAllocationMock = vi.fn();

vi.mock('../../config/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../data/lead-allocation-store', () => ({
  addAllocations: (...args: unknown[]) => addAllocationsMock(...args),
  listAllocations: (...args: unknown[]) => listAllocationsMock(...args),
  updateAllocation: (...args: unknown[]) => updateAllocationMock(...args),
  isStorageInitializationError: () => false,
  isStorageUnavailableError: () => false,
}));

vi.mock('../../services/lead-engine-client', () => ({
  leadEngineClient: {
    fetchLeadsByAgreement: vi.fn(),
    getFallbackLeadsForAgreement: vi.fn(() => []),
  },
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {},
}));

let leadEngineRouter: express.Router;
let errorHandler: express.RequestHandler;

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as express.Request).user = {
      id: 'user-1',
      tenantId: 'tenant-test',
      email: 'agent@example.com',
      name: 'Agent',
      role: 'ADMIN',
      isActive: true,
      permissions: ['campaigns:read'],
    } as express.Request['user'];
    next();
  });
  app.use('/api/lead-engine', leadEngineRouter);
  app.use(errorHandler as express.RequestHandler);
  return app;
};

beforeAll(async () => {
  process.env.LEAD_ENGINE_BROKER_BASE_URL = process.env.LEAD_ENGINE_BROKER_BASE_URL ?? 'https://broker.example.com';
  process.env.LEAD_ENGINE_BASIC_TOKEN = process.env.LEAD_ENGINE_BASIC_TOKEN ?? 'basic-token-value';
  ({ leadEngineRouter } = await import('../lead-engine'));
  ({ errorHandler } = await import('../../middleware/error-handler'));
});

afterEach(() => {
  listAllocationsMock.mockReset();
  addAllocationsMock.mockReset();
  updateAllocationMock.mockReset();
});

describe('Lead Engine allocations routes', () => {
  const originalBaseUrl = process.env.LEAD_ENGINE_BROKER_BASE_URL;
  const originalBasicToken = process.env.LEAD_ENGINE_BASIC_TOKEN;

  beforeEach(() => {
    process.env.LEAD_ENGINE_BROKER_BASE_URL = 'https://broker.example.com';
    process.env.LEAD_ENGINE_BASIC_TOKEN = 'basic-token-value';
  });

  afterEach(() => {
    if (originalBaseUrl === undefined) {
      delete process.env.LEAD_ENGINE_BROKER_BASE_URL;
    } else {
      process.env.LEAD_ENGINE_BROKER_BASE_URL = originalBaseUrl;
    }
    if (originalBasicToken === undefined) {
      delete process.env.LEAD_ENGINE_BASIC_TOKEN;
    } else {
      process.env.LEAD_ENGINE_BASIC_TOKEN = originalBasicToken;
    }
  });

  it('returns allocations when filtering by instanceId only', async () => {
    const allocationSample = {
      allocationId: 'alloc-1',
      leadId: 'lead-1',
      tenantId: 'tenant-test',
      campaignId: 'camp-1',
      campaignName: 'Campanha WhatsApp',
      agreementId: 'agreement-1',
      instanceId: 'instance-42',
      status: 'contacted',
      receivedAt: '2024-03-10T10:00:00.000Z',
      updatedAt: '2024-03-10T11:00:00.000Z',
      fullName: 'Contato WhatsApp',
      document: '12345678901',
      registrations: [],
      tags: [],
    };

    listAllocationsMock.mockResolvedValueOnce([allocationSample]);

    const app = buildApp();
    const response = await request(app)
      .get('/api/lead-engine/allocations')
      .query({ instanceId: 'instance-42' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: [allocationSample],
      meta: {
        total: 1,
        summary: {
          total: 1,
          contacted: 1,
          won: 0,
          lost: 0,
        },
      },
    });

    expect(listAllocationsMock).toHaveBeenCalledWith('tenant-test', {
      agreementId: undefined,
      campaignId: undefined,
      instanceId: 'instance-42',
      statuses: undefined,
    });
  });
});
