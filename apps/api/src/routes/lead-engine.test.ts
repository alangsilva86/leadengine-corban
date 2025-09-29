import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { beforeEach, describe, expect, it } from 'vitest';
import { CampaignStatus, resetCampaignStore } from '@ticketz/storage';

import { leadEngineRouter } from './lead-engine';
import { errorHandler } from '../middleware/error-handler';

const startTestServer = () =>
  new Promise<{ server: Server; url: string }>((resolve) => {
    const app = express();
    app.use(express.json());
    app.use('/api/lead-engine', leadEngineRouter);
    app.use(errorHandler);

    const server = app.listen(0, () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });

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
  beforeEach(() => {
    resetCampaignStore();
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
