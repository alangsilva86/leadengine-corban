import express, { type Request } from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CampaignStatus, resetCampaignStore, resetAllocationStore } from '@ticketz/storage';

vi.mock('@ticketz/storage', () => import('../test-utils/storage-mock'));

import { errorHandler } from '../middleware/error-handler';

const originalLeadEngineEnv = {
  baseUrl: process.env.LEAD_ENGINE_BROKER_BASE_URL,
  basicToken: process.env.LEAD_ENGINE_BASIC_TOKEN,
};

const ensureLeadEngineEnv = () => {
  process.env.LEAD_ENGINE_BROKER_BASE_URL =
    process.env.LEAD_ENGINE_BROKER_BASE_URL || 'https://lead-engine.test';
  process.env.LEAD_ENGINE_BASIC_TOKEN = process.env.LEAD_ENGINE_BASIC_TOKEN || 'basic-token';
};

const restoreLeadEngineEnv = () => {
  if (typeof originalLeadEngineEnv.baseUrl === 'string') {
    process.env.LEAD_ENGINE_BROKER_BASE_URL = originalLeadEngineEnv.baseUrl;
  } else {
    delete process.env.LEAD_ENGINE_BROKER_BASE_URL;
  }

  if (typeof originalLeadEngineEnv.basicToken === 'string') {
    process.env.LEAD_ENGINE_BASIC_TOKEN = originalLeadEngineEnv.basicToken;
  } else {
    delete process.env.LEAD_ENGINE_BASIC_TOKEN;
  }
};

const startTestServer = async (
  options: { setupMocks?: () => void | Promise<void> } = {}
) => {
  vi.resetModules();
  ensureLeadEngineEnv();
  if (options.setupMocks) {
    await options.setupMocks();
  }
  const { leadEngineRouter } = await import('./lead-engine');

  return new Promise<{ server: Server; url: string }>((resolve) => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as Request).user = {
        id: 'user-1',
        tenantId: 'tenant-123',
        email: 'agent@example.com',
        name: 'Agent',
        role: 'ADMIN',
        isActive: true,
        permissions: ['campaigns:read', 'campaigns:write'],
      } as Request['user'];
      next();
    });
    app.use('/api/lead-engine', leadEngineRouter);
    app.use(errorHandler);

    const server = app.listen(0, () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
};

const stopTestServer = (server: Server) =>
  new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

describe('Lead Engine campaigns routes', () => {
  beforeEach(async () => {
    await resetCampaignStore();
    await resetAllocationStore();
  });

  afterEach(() => {
    restoreLeadEngineEnv();
  });

  it('creates or reactivates a campaign', async () => {
    const { server, url } = await startTestServer();

    try {
      const response = await fetch(`${url}/api/lead-engine/campaigns`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-tenant-id': 'tenant-123',
        },
        body: JSON.stringify({
          agreementId: 'agreement-1',
          instanceId: 'instance-1',
          name: 'New Campaign',
          status: CampaignStatus.PAUSED,
        }),
      });

      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toMatchObject({
        agreementId: 'agreement-1',
        instanceId: 'instance-1',
        name: 'New Campaign',
        status: CampaignStatus.PAUSED,
      });
      expect(body.data.id).toBeDefined();
      expect(body.data.tenantId).toBe('tenant-123');

      // Reactivate the same campaign
      const secondResponse = await fetch(`${url}/api/lead-engine/campaigns`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-tenant-id': 'tenant-123',
        },
        body: JSON.stringify({
          agreementId: 'agreement-1',
          instanceId: 'instance-1',
          name: 'Updated Campaign Name',
          status: CampaignStatus.ACTIVE,
        }),
      });

      const secondBody = await secondResponse.json();

      expect(secondResponse.status).toBe(200);
      expect(secondBody.success).toBe(true);
      expect(secondBody.data.id).toBe(body.data.id);
      expect(secondBody.data.name).toBe('Updated Campaign Name');
      expect(secondBody.data.status).toBe(CampaignStatus.ACTIVE);
    } finally {
      await stopTestServer(server);
    }
  });

  it('creates a campaign using agreementName as alias for name', async () => {
    const { server, url } = await startTestServer();

    try {
      const response = await fetch(`${url}/api/lead-engine/campaigns`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-tenant-id': 'tenant-123',
        },
        body: JSON.stringify({
          agreementId: 'agreement-1',
          instanceId: 'instance-1',
          agreementName: 'Alias Campaign',
        }),
      });

      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('Alias Campaign');
    } finally {
      await stopTestServer(server);
    }
  });

  it('rejects requests when tenant header mismatches authenticated context', async () => {
    const { server, url } = await startTestServer();

    try {
      const response = await fetch(`${url}/api/lead-engine/campaigns`, {
        headers: { 'x-tenant-id': 'tenant-other' },
      });

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('FORBIDDEN');
    } finally {
      await stopTestServer(server);
    }
  });

  it('lists campaigns filtered by agreement and status', async () => {
    const { server, url } = await startTestServer();

    try {
      // Seed campaigns
      const createCampaign = async (payload: Record<string, unknown>) => {
        const response = await fetch(`${url}/api/lead-engine/campaigns`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-tenant-id': 'tenant-xyz',
          },
          body: JSON.stringify(payload),
        });

        expect(response.status).toBe(200);
        const result = await response.json();
        expect(result.success).toBe(true);
        return result;
      };

      await createCampaign({
        agreementId: 'agreement-a',
        instanceId: 'instance-1',
        name: 'Active Campaign',
        status: CampaignStatus.ACTIVE,
      });
      await createCampaign({
        agreementId: 'agreement-a',
        instanceId: 'instance-2',
        name: 'Paused Campaign',
        status: CampaignStatus.PAUSED,
      });
      await createCampaign({
        agreementId: 'agreement-b',
        instanceId: 'instance-3',
        name: 'Completed Campaign',
        status: CampaignStatus.COMPLETED,
      });

      const response = await fetch(
        `${url}/api/lead-engine/campaigns?agreementId=agreement-a&status=${encodeURIComponent(
          'ACTIVE,PAUSED'
        )}`,
        {
          headers: {
            'x-tenant-id': 'tenant-xyz',
          },
        }
      );

      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data).toHaveLength(2);
      const statuses = body.data.map((campaign: { status: CampaignStatus }) => campaign.status);
      expect(statuses).toEqual([CampaignStatus.ACTIVE, CampaignStatus.PAUSED]);
      const agreements = body.data.map((campaign: { agreementId: string }) => campaign.agreementId);
      expect(new Set(agreements)).toEqual(new Set(['agreement-a']));
    } finally {
      await stopTestServer(server);
    }
  });

  it('validates required fields on POST /campaigns', async () => {
    const { server, url } = await startTestServer();

    try {
      const response = await fetch(`${url}/api/lead-engine/campaigns`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-tenant-id': 'tenant-123',
        },
        body: JSON.stringify({}),
      });

      const text = await response.text();
      expect(response.status, text).toBe(400);
      const body = JSON.parse(text);
      expect(body.error?.code).toBe('VALIDATION_ERROR');
      expect(body.error?.details).toBeDefined();
    } finally {
      await stopTestServer(server);
    }
  });
});

describe('Lead Engine allocations routes', () => {
  beforeEach(async () => {
    await resetCampaignStore();
    await resetAllocationStore();
  });

  afterEach(() => {
    restoreLeadEngineEnv();
  });

  it('pulls, lists, updates and exports allocations', async () => {
    const { server, url } = await startTestServer();

    try {
      const postResponse = await fetch(`${url}/api/lead-engine/allocations`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-tenant-id': 'tenant-alloc',
        },
        body: JSON.stringify({
          campaignId: 'campaign-123',
          agreementId: 'saec-goiania',
          take: 3,
        }),
      });

      expect(postResponse.status).toBe(200);
      const postBody = await postResponse.json();
      expect(postBody.success).toBe(true);
      expect(Array.isArray(postBody.data)).toBe(true);
      expect(postBody.data.length).toBeGreaterThan(0);

      const listResponse = await fetch(
        `${url}/api/lead-engine/allocations?campaignId=campaign-123`,
        {
          headers: {
            'x-tenant-id': 'tenant-alloc',
          },
        }
      );

      expect(listResponse.status).toBe(200);
      const listBody = await listResponse.json();
      expect(listBody.success).toBe(true);
      expect(Array.isArray(listBody.data)).toBe(true);
      expect(listBody.data.length).toBe(postBody.data.length);
      expect(listBody.meta.summary.total).toBe(postBody.data.length);

      const allocationId = listBody.data[0].allocationId;

      const patchResponse = await fetch(
        `${url}/api/lead-engine/allocations/${allocationId}`,
        {
          method: 'PATCH',
          headers: {
            'content-type': 'application/json',
            'x-tenant-id': 'tenant-alloc',
          },
          body: JSON.stringify({ status: 'won' }),
        }
      );

      expect(patchResponse.status).toBe(200);
      const patchBody = await patchResponse.json();
      expect(patchBody.success).toBe(true);
      expect(patchBody.data.status).toBe('won');

      const filteredResponse = await fetch(
        `${url}/api/lead-engine/allocations?campaignId=campaign-123&status=won`,
        {
          headers: {
            'x-tenant-id': 'tenant-alloc',
          },
        }
      );

      expect(filteredResponse.status).toBe(200);
      const filteredBody = await filteredResponse.json();
      expect(filteredBody.success).toBe(true);
      expect(filteredBody.data.length).toBeGreaterThan(0);
      expect(filteredBody.data[0].status).toBe('won');

      const exportResponse = await fetch(
        `${url}/api/lead-engine/allocations/export?campaignId=campaign-123`,
        {
          headers: {
            'x-tenant-id': 'tenant-alloc',
          },
        }
      );

      expect(exportResponse.status).toBe(200);
      expect(exportResponse.headers.get('content-type')).toContain('text/csv');
      const csv = await exportResponse.text();
      expect(csv).toContain('allocationId');
      expect(csv).toContain(allocationId);
    } finally {
      await stopTestServer(server);
    }
  });

  it('rejects invalid status filters', async () => {
    const { server, url } = await startTestServer();

    try {
      const response = await fetch(
        `${url}/api/lead-engine/allocations?status=unknown`,
        {
          headers: {
            'x-tenant-id': 'tenant-alloc',
          },
        }
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVALID_ALLOCATION_STATUS');
    } finally {
      await stopTestServer(server);
    }
  });

  it('returns an empty list when storage is not initialized', async () => {
    const storageError = Object.assign(new Error('Storage not initialized'), {
      code: 'STORAGE_NOT_INITIALIZED',
    });

    const { server, url } = await startTestServer({
      setupMocks: async () => {
        const actual = await vi.importActual<
          typeof import('../data/lead-allocation-store')
        >('../data/lead-allocation-store');

        vi.doMock('../data/lead-allocation-store', () => ({
          ...actual,
          listAllocations: vi.fn().mockRejectedValue(storageError),
        }));
      },
    });

    try {
      const response = await fetch(`${url}/api/lead-engine/allocations?campaignId=campaign-123`, {
        headers: {
          'x-tenant-id': 'tenant-alloc',
        },
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data).toEqual([]);
      expect(body.meta.summary).toEqual({ total: 0, contacted: 0, won: 0, lost: 0 });
    } finally {
      vi.doUnmock('../data/lead-allocation-store');
      await stopTestServer(server);
    }
  });
});
