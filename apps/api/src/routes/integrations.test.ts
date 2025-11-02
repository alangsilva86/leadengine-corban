import express from 'express';
import type { Request } from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { Prisma, type WhatsAppInstance as PrismaWhatsAppInstance } from '@prisma/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { refreshWhatsAppEnv } from '../config/whatsapp';
import type { WhatsAppTransport } from '../features/whatsapp-transport';

import { errorHandler } from '../middleware/error-handler';
import { normalizePhoneNumber } from '../utils/phone';
import {
  WhatsAppBrokerError,
  type WhatsAppBrokerInstanceSnapshot,
} from '../services/whatsapp-broker-client';

vi.mock('../middleware/auth', async () => {
  const actual = await vi.importActual<typeof import('../middleware/auth')>(
    '../middleware/auth'
  );
  return {
    ...actual,
    requireTenant: (_req: unknown, _res: unknown, next: () => void) => next(),
  };
});

function createModelMock() {
  return {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    upsert: vi.fn(),
  };
}

const createDatabaseDisabledError = () => {
  const error = new Error('Database disabled for this environment');
  error.name = 'DatabaseDisabledError';
  (error as Error & { code?: string }).code = 'DATABASE_DISABLED';
  return error;
};

const prismaMockContainer = vi.hoisted(() => ({
  value: {
    whatsAppInstance: createModelMock(),
    campaign: createModelMock(),
    processedIntegrationEvent: createModelMock(),
    integrationState: createModelMock(),
    contact: createModelMock(),
    ticket: createModelMock(),
    user: createModelMock(),
    $transaction: vi.fn(),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  } as Record<string, ReturnType<typeof createModelMock> | ReturnType<typeof vi.fn>>,
}));

vi.mock('../lib/prisma', () => ({
  prisma: prismaMockContainer.value,
}));

const prismaMock = prismaMockContainer.value;

const emitToTenantMock = vi.fn();

vi.mock('../lib/socket-registry', () => ({
  emitToTenant: emitToTenantMock,
}));

const sendAdHocMock = vi.fn();

vi.mock('../services/ticket-service', async () => {
  const actual = await vi.importActual<typeof import('../services/ticket-service')>(
    '../services/ticket-service'
  );

  return {
    ...actual,
    sendAdHoc: sendAdHocMock,
  };
});

const prismaModelKeys = [
  'whatsAppInstance',
  'campaign',
  'processedIntegrationEvent',
  'integrationState',
  'contact',
  'ticket',
  'user',
] as const;

const resetPrismaMocks = () => {
  prismaModelKeys.forEach((modelKey) => {
    const model = prismaMock[modelKey] as ReturnType<typeof createModelMock>;
    Object.values(model).forEach((fn) => fn.mockReset());
  });

  const transactionMock = prismaMock.$transaction as ReturnType<typeof vi.fn>;
  transactionMock.mockReset();
  transactionMock.mockImplementation(async (callback: (tx: typeof prismaMock) => unknown) => {
    return await callback(prismaMock as never);
  });

  (prismaMock.$connect as ReturnType<typeof vi.fn>).mockReset();
  (prismaMock.$disconnect as ReturnType<typeof vi.fn>).mockReset();

  const instanceModel = prismaMock.whatsAppInstance as ReturnType<typeof createModelMock>;
  instanceModel.findMany.mockResolvedValue([]);
  instanceModel.findUnique.mockResolvedValue(null);
  instanceModel.findFirst.mockResolvedValue(null);
  instanceModel.update.mockResolvedValue(null);
  instanceModel.create.mockResolvedValue(null);
  instanceModel.delete.mockResolvedValue(null);

  const integrationStateModel = prismaMock.integrationState as ReturnType<typeof createModelMock>;
  integrationStateModel.findUnique.mockResolvedValue(null);
  integrationStateModel.update.mockResolvedValue(null);
  integrationStateModel.create.mockResolvedValue(null);
  integrationStateModel.delete.mockResolvedValue(null);
  integrationStateModel.upsert.mockResolvedValue(null);

  const userModel = prismaMock.user as ReturnType<typeof createModelMock>;
  userModel.findUnique.mockResolvedValue(null);
};

resetPrismaMocks();

const originalWhatsAppEnv = {
  url: process.env.WHATSAPP_BROKER_URL,
  apiKey: process.env.WHATSAPP_BROKER_API_KEY,
};

const restoreWhatsAppEnv = () => {
  if (typeof originalWhatsAppEnv.url === 'string') {
    process.env.WHATSAPP_BROKER_URL = originalWhatsAppEnv.url;
  } else {
    delete process.env.WHATSAPP_BROKER_URL;
  }

  if (typeof originalWhatsAppEnv.apiKey === 'string') {
    process.env.WHATSAPP_BROKER_API_KEY = originalWhatsAppEnv.apiKey;
  } else {
    delete process.env.WHATSAPP_BROKER_API_KEY;
  }

};

afterEach(() => {
  vi.restoreAllMocks();
  restoreWhatsAppEnv();
  resetPrismaMocks();
  emitToTenantMock.mockReset();
  sendAdHocMock.mockReset();
  refreshWhatsAppEnv();
});

const startTestServer = async ({
  configureWhatsApp = false,
}: { configureWhatsApp?: boolean } = {}) => {
  vi.resetModules();
  if (configureWhatsApp) {
    process.env.WHATSAPP_BROKER_URL = 'http://broker.test';
    process.env.WHATSAPP_BROKER_API_KEY = 'test-key';
  } else {
    delete process.env.WHATSAPP_BROKER_URL;
    delete process.env.WHATSAPP_BROKER_API_KEY;
  }
  refreshWhatsAppEnv();

  const { integrationsRouter } = await import('./integrations');
  const { whatsappMessagesRouter } = await import('./integrations/whatsapp.messages');

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as Request).user = {
      id: 'user-1',
      tenantId: 'tenant-123',
      email: 'user@example.com',
      name: 'Test User',
      role: 'ADMIN',
      isActive: true,
      permissions: [],
    };
    next();
  });
  app.use('/api', whatsappMessagesRouter);
  app.use('/api/integrations', integrationsRouter);
  app.use(errorHandler);

  return new Promise<{ server: Server; url: string }>((resolve) => {
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

describe('syncInstancesFromBroker heuristics', () => {
  it('keeps stored nickname when broker suggests a different name', async () => {
    const { syncInstancesFromBroker } = await import('../modules/whatsapp/instances/service');

    const existingInstance: PrismaWhatsAppInstance = {
      id: 'custom-slug',
      tenantId: 'tenant-123',
      name: 'Minha Loja',
      brokerId: 'custom-slug',
      phoneNumber: null,
      status: 'connected',
      connected: true,
      lastSeenAt: null,
      createdAt: new Date('2023-12-01T00:00:00.000Z'),
      updatedAt: new Date('2023-12-01T00:00:00.000Z'),
      metadata: {
        displayName: 'Minha Loja',
        label: 'Minha Loja',
      } as Prisma.JsonValue,
    };

    (prismaMock.whatsAppInstance.update as ReturnType<typeof vi.fn>).mockResolvedValue(existingInstance);

    const snapshot: WhatsAppBrokerInstanceSnapshot = {
      instance: {
        id: 'custom-slug',
        tenantId: 'tenant-123',
        name: 'Loja do Broker',
        status: 'connected',
        connected: true,
        lastActivity: null,
      },
      status: {
        status: 'connected',
        connected: true,
        qr: null,
        qrCode: null,
        expiresAt: null,
        qrExpiresAt: null,
      },
    };

    await syncInstancesFromBroker('tenant-123', [existingInstance], [snapshot]);

    expect(prismaMock.whatsAppInstance.update).toHaveBeenCalledTimes(1);
    const updatePayload = (prismaMock.whatsAppInstance.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(updatePayload.data).not.toHaveProperty('name');
    expect(updatePayload.data).toMatchObject({ brokerId: 'custom-slug' });

    const metadata = updatePayload.data.metadata as Record<string, unknown>;
    expect(metadata.displayName).toBe('Minha Loja');
    expect(metadata.label).toBe('Minha Loja');
  });
});

describe('WhatsApp integration routes when broker is not configured', () => {
  it('returns empty list when broker is disabled and no instances are stored', async () => {
    const { server, url } = await startTestServer();
    const { prisma } = await import('../lib/prisma');

    prisma.whatsAppInstance.findMany.mockResolvedValue([]);

    try {
      const response = await fetch(`${url}/api/integrations/whatsapp/instances`, {
        method: 'GET',
        headers: {
          'x-tenant-id': 'tenant-123',
        },
      });

      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        success: true,
        data: { instances: [] },
      });
    } finally {
      await stopTestServer(server);
    }
  });

  it('fails to create a WhatsApp instance when broker configuration is missing', async () => {
    const { server, url } = await startTestServer();
    const { prisma } = await import('../lib/prisma');

    try {
      const response = await fetch(`${url}/api/integrations/whatsapp/instances`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-tenant-id': 'tenant-123',
        },
        body: JSON.stringify({ name: 'created-instance' }),
      });

      const body = await response.json();

      expect(response.status).toBe(503);
      expect(body).toMatchObject({
        success: false,
        error: { code: 'WHATSAPP_NOT_CONFIGURED' },
      });
      expect(prisma.whatsAppInstance.create).not.toHaveBeenCalled();
    } finally {
      await stopTestServer(server);
    }
  });

  it('responds with 400 when Prisma rejects WhatsApp instance payload', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const { prisma } = await import('../lib/prisma');
    const { whatsappBrokerClient } = await import('../services/whatsapp-broker-client');

    const validationError = Object.create(Prisma.PrismaClientValidationError.prototype);
    validationError.message = 'Invalid data';

    vi.spyOn(whatsappBrokerClient, 'createInstance').mockResolvedValue({
      id: 'tenant-123--invalid-instance',
      tenantId: 'tenant-123',
      name: 'invalid-instance',
      status: 'connecting',
      connected: false,
    });
    prisma.whatsAppInstance.create.mockRejectedValue(validationError);

    try {
      const response = await fetch(`${url}/api/integrations/whatsapp/instances`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-tenant-id': 'tenant-123',
        },
        body: JSON.stringify({ name: 'invalid-instance' }),
      });

      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body).toMatchObject({
        success: false,
        error: {
          code: 'INVALID_INSTANCE_PAYLOAD',
          message: expect.stringContaining('Não foi possível criar a instância WhatsApp'),
        },
      });
      expect(emitToTenantMock).not.toHaveBeenCalled();
    } finally {
      await stopTestServer(server);
    }
  });

  const brokerDependentRoutes = [
    {
      name: 'pair instance',
      method: 'POST',
      path: '/whatsapp/instances/test-instance/pair',
      setup: () => {
        (prismaMock.whatsAppInstance.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
          id: 'test-instance',
          tenantId: 'tenant-123',
          name: 'Test Instance',
          brokerId: 'test-instance',
          phoneNumber: null,
          status: 'disconnected',
          connected: false,
          lastSeenAt: null,
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
          updatedAt: new Date('2024-01-01T00:00:00.000Z'),
          metadata: { history: [] },
        });
      },
    },
    {
      name: 'stop instance',
      method: 'POST',
      path: '/whatsapp/instances/test-instance/stop',
      setup: () => {
        (prismaMock.whatsAppInstance.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
          id: 'test-instance',
          tenantId: 'tenant-123',
          name: 'Test Instance',
          brokerId: 'test-instance',
          phoneNumber: null,
          status: 'connected',
          connected: true,
          lastSeenAt: new Date('2024-01-01T00:00:00.000Z'),
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
          updatedAt: new Date('2024-01-01T00:00:00.000Z'),
          metadata: { history: [] },
        });
      },
    },
    {
      name: 'get QR code',
      method: 'GET',
      path: '/whatsapp/instances/test-instance/qr',
      setup: () => {
        (prismaMock.whatsAppInstance.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
          id: 'test-instance',
          tenantId: 'tenant-123',
          name: 'Test Instance',
          brokerId: 'test-instance',
          phoneNumber: null,
          status: 'disconnected',
          connected: false,
          lastSeenAt: null,
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
          updatedAt: new Date('2024-01-01T00:00:00.000Z'),
          metadata: { history: [] },
        });
      },
    },
    {
      name: 'get status',
      method: 'GET',
      path: '/whatsapp/instances/test-instance/status',
      setup: () => {
        (prismaMock.whatsAppInstance.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
          id: 'test-instance',
          tenantId: 'tenant-123',
          name: 'Test Instance',
          brokerId: 'test-instance',
          phoneNumber: null,
          status: 'connected',
          connected: true,
          lastSeenAt: null,
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
          updatedAt: new Date('2024-01-01T00:00:00.000Z'),
          metadata: { history: [] },
        });
      },
    },
  ] as const;

  it.each(brokerDependentRoutes)('responds with 503 for %s', async ({ method, path, setup }) => {
    const { server, url } = await startTestServer();

    setup?.();

    try {
      const response = await fetch(`${url}/api/integrations${path}`, {
        method,
        headers: {
          'x-tenant-id': 'tenant-123',
        },
      });

      const responseBody = await response.json();

      expect(response.status).toBe(503);
      expect(responseBody).toMatchObject({
        success: false,
        error: { code: 'WHATSAPP_NOT_CONFIGURED' },
      });
    } finally {
      await stopTestServer(server);
    }
  });

  it('responds with 503 when pairing an instance without broker configuration', async () => {
    const { server, url } = await startTestServer();
    const { prisma } = await import('../lib/prisma');

    const storedInstance = {
      id: 'leadengine-default',
      tenantId: 'tenant-123',
      name: 'Default Instance',
      brokerId: 'leadengine-default',
      phoneNumber: null,
      status: 'disconnected',
      connected: false,
      lastSeenAt: null,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
      metadata: { history: [] },
    } as Awaited<ReturnType<typeof prisma.whatsAppInstance.findFirst>>;

    prisma.whatsAppInstance.findFirst.mockResolvedValue(storedInstance);

    try {
      const response = await fetch(
        `${url}/api/integrations/whatsapp/instances/${storedInstance.id}/pair`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-tenant-id': 'tenant-123',
          },
        }
      );

      const responseBody = await response.json();

      expect(response.status).toBe(503);
      expect(responseBody).toMatchObject({
        success: false,
        error: { code: 'WHATSAPP_NOT_CONFIGURED' },
      });
    } finally {
      delete process.env.LEADENGINE_INSTANCE_ID;
      await stopTestServer(server);
    }
  });

  it('responds with 410 when pairing without providing an instance id', async () => {
    const { server, url } = await startTestServer();

    try {
      const response = await fetch(`${url}/api/integrations/whatsapp/instances/pair`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-tenant-id': 'tenant-123',
        },
      });

      const responseBody = await response.json();

      expect(response.status).toBe(410);
      expect(responseBody).toMatchObject({
        success: false,
        error: { code: 'PAIR_ROUTE_MISSING_ID' },
      });
    } finally {
      delete process.env.LEADENGINE_INSTANCE_ID;
      await stopTestServer(server);
    }
  });

  it('responds with 503 when disconnecting the default instance without broker configuration', async () => {
    const { server, url } = await startTestServer();
    const { prisma } = await import('../lib/prisma');

    const storedInstance = {
      id: 'leadengine-default',
      tenantId: 'tenant-123',
      name: 'Default Instance',
      brokerId: 'leadengine-default',
      phoneNumber: null,
      status: 'connected',
      connected: true,
      lastSeenAt: new Date('2024-01-01T00:00:00.000Z'),
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
      metadata: { history: [] },
    } as Awaited<ReturnType<typeof prisma.whatsAppInstance.findFirst>>;

    prisma.whatsAppInstance.findFirst.mockResolvedValue(storedInstance);

    try {
      const response = await fetch(`${url}/api/integrations/whatsapp/instances/disconnect`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-tenant-id': 'tenant-123',
        },
        body: JSON.stringify({ instanceId: storedInstance.id }),
      });

      const responseBody = await response.json();

      expect(response.status).toBe(503);
      expect(responseBody).toMatchObject({
        success: false,
        error: { code: 'WHATSAPP_NOT_CONFIGURED' },
      });
    } finally {
      delete process.env.LEADENGINE_INSTANCE_ID;
      await stopTestServer(server);
    }
  });
});

describe('WhatsApp integration routes with configured broker', () => {
  it('lists WhatsApp instances', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const { prisma } = await import('../lib/prisma');
    const { whatsappBrokerClient } = await import('../services/whatsapp-broker-client');

    const storedInstances = [
      {
        id: 'instance-1',
        tenantId: 'tenant-123',
        name: 'Main Instance',
        brokerId: 'broker-1',
        phoneNumber: '+5511987654321',
        status: 'connected',
        connected: true,
        lastSeenAt: new Date('2024-01-02T00:00:00.000Z'),
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-01T01:00:00.000Z'),
        metadata: {
          displayId: 'instance-1',
          history: [
            {
              action: 'broker-sync',
              by: 'system',
              at: new Date('2024-01-01T02:00:00.000Z').toISOString(),
              status: 'connected',
              connected: true,
            },
          ],
          lastBrokerSnapshot: {
            status: 'connected',
            connected: true,
            metrics: { messagesSent: 15 },
          },
        },
      },
      {
        id: 'instance-2',
        tenantId: 'tenant-123',
        name: 'Backup Instance',
        brokerId: 'broker-2',
        phoneNumber: null,
        status: 'disconnected',
        connected: false,
        lastSeenAt: null,
        createdAt: new Date('2024-01-03T00:00:00.000Z'),
        updatedAt: new Date('2024-01-03T00:00:00.000Z'),
        metadata: {
          history: [],
        },
      },
    ] as unknown as Awaited<ReturnType<typeof prisma.whatsAppInstance.findMany>>;

    prisma.whatsAppInstance.findMany.mockResolvedValue(storedInstances);
    prisma.whatsAppInstance.update.mockImplementation(async ({ where, data }) => {
      const match = storedInstances.find((instance) => instance.id === where.id);
      if (match) {
        Object.assign(match, data);
        return match as Awaited<ReturnType<typeof prisma.whatsAppInstance.update>>;
      }

      return storedInstances[0] as Awaited<ReturnType<typeof prisma.whatsAppInstance.update>>;
    });

    const brokerSnapshots: WhatsAppBrokerInstanceSnapshot[] = [
      {
        instance: {
          id: 'broker-1',
          tenantId: 'tenant-123',
          name: 'Main Instance',
          status: 'connected',
          connected: true,
          phoneNumber: '+5511987654321',
          lastActivity: '2024-01-02T02:00:00.000Z',
          stats: { totalSent: 42 },
        },
        status: {
          status: 'connected',
          connected: true,
          qr: null,
          qrCode: null,
          qrExpiresAt: null,
          expiresAt: null,
          stats: { totalSent: 42, queued: 3, failed: 1 },
          metrics: { throughput: { perMinute: 18 } },
          messages: { sent: 42 },
          rate: { limit: 100, remaining: 97, resetAt: '2024-01-01T01:30:00.000Z' },
          rateUsage: { limit: 100, used: 3 },
          raw: { stats: { totalSent: 42, queued: 3, failed: 1 } },
        },
      },
      {
        instance: {
          id: 'broker-2',
          tenantId: 'tenant-123',
          name: 'Backup Instance',
          status: 'disconnected',
          connected: false,
          phoneNumber: null,
        },
        status: {
          status: 'disconnected',
          connected: false,
          qr: null,
          qrCode: null,
          qrExpiresAt: null,
          expiresAt: null,
          stats: null,
          metrics: null,
          messages: null,
          rate: null,
          rateUsage: null,
          raw: null,
        },
      },
    ];

    const listSpy = vi
      .spyOn(whatsappBrokerClient, 'listInstances')
      .mockResolvedValue(brokerSnapshots);

    try {
      const response = await fetch(`${url}/api/integrations/whatsapp/instances`, {
        method: 'GET',
        headers: {
          'x-tenant-id': 'tenant-123',
        },
      });

      const body = await response.json();

      expect(prisma.whatsAppInstance.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-123' },
        orderBy: { createdAt: 'asc' },
      });
      expect(listSpy).toHaveBeenCalledWith('tenant-123');
      expect(prisma.whatsAppInstance.update).toHaveBeenCalled();
      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        success: true,
        data: {
          instances: [
            expect.objectContaining({
              id: 'instance-1',
              status: 'connected',
              connected: true,
              phoneNumber: '+5511987654321',
              metadata: expect.objectContaining({
                lastBrokerSnapshot: expect.objectContaining({
                  status: 'connected',
                  connected: true,
                  metrics: expect.objectContaining({ throughput: expect.any(Object) }),
                  stats: expect.objectContaining({ totalSent: 42, queued: 3 }),
                  rate: expect.objectContaining({ limit: 100, remaining: 97 }),
                }),
              }),
            }),
            expect.objectContaining({
              id: 'instance-2',
              status: 'disconnected',
              connected: false,
            }),
          ],
        },
      });
    } finally {
      await stopTestServer(server);
    }
  });

  it('falls back to broker snapshots when persistence is unavailable', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const { prisma } = await import('../lib/prisma');
    const { whatsappBrokerClient } = await import('../services/whatsapp-broker-client');

    const prismaError = Object.assign(new Error('whatsapp_instances table is missing'), {
      code: 'P2021',
    });

    prisma.whatsAppInstance.findMany.mockRejectedValue(prismaError);

    const brokerSnapshots: WhatsAppBrokerInstanceSnapshot[] = [
      {
        instance: {
          id: 'broker-instance-1',
          tenantId: 'tenant-123',
          name: 'Broker Snapshot 1',
          status: 'connected',
          connected: true,
          phoneNumber: '+5511988888888',
          lastActivity: '2024-01-02T00:00:00.000Z',
        },
        status: {
          status: 'connected',
          connected: true,
          metrics: { throughput: { perMinute: 10 } },
          stats: { sent: 5 },
          rate: { limit: 30, remaining: 29 },
          rateUsage: { used: 1 },
          messages: { sent: 5 },
          raw: { debug: true },
          qr: null,
          qrCode: null,
          qrExpiresAt: null,
          expiresAt: null,
        },
      },
    ];

    const listSpy = vi
      .spyOn(whatsappBrokerClient, 'listInstances')
      .mockResolvedValue(brokerSnapshots);

    try {
      const response = await fetch(`${url}/api/integrations/whatsapp/instances`, {
        method: 'GET',
        headers: {
          'x-tenant-id': 'tenant-123',
        },
      });

      const body = await response.json();

      expect(response.status).toBe(200);
      expect(listSpy).toHaveBeenCalledWith('tenant-123');
      expect(body).toMatchObject({
        success: true,
        data: {
          instances: [
            expect.objectContaining({
              id: 'broker-instance-1',
              status: 'connected',
              connected: true,
              metadata: expect.objectContaining({ fallbackSource: 'broker-snapshot' }),
            }),
          ],
        },
        meta: expect.objectContaining({
          storageFallback: true,
        }),
      });
    } finally {
      await stopTestServer(server);
    }
  });

  it('falls back to broker snapshots when database access is disabled', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const { prisma } = await import('../lib/prisma');
    const { whatsappBrokerClient } = await import('../services/whatsapp-broker-client');

    prisma.whatsAppInstance.findMany.mockRejectedValue(createDatabaseDisabledError());

    const brokerSnapshots: WhatsAppBrokerInstanceSnapshot[] = [
      {
        instance: {
          id: 'broker-instance-disabled',
          tenantId: 'tenant-123',
          name: 'Fallback Snapshot',
          status: 'connected',
          connected: true,
          phoneNumber: '+5511999998888',
          lastActivity: '2024-01-10T00:00:00.000Z',
        },
        status: {
          status: 'connected',
          connected: true,
          qr: null,
          qrCode: null,
          qrExpiresAt: null,
          expiresAt: null,
          metrics: null,
          messages: null,
          rate: null,
          rateUsage: null,
          raw: null,
          stats: null,
        },
      },
    ];

    const listSpy = vi
      .spyOn(whatsappBrokerClient, 'listInstances')
      .mockResolvedValue(brokerSnapshots);

    try {
      const response = await fetch(`${url}/api/integrations/whatsapp/instances`, {
        method: 'GET',
        headers: {
          'x-tenant-id': 'tenant-123',
        },
      });

      const body = await response.json();

      expect(response.status).toBe(200);
      expect(listSpy).toHaveBeenCalledWith('tenant-123');
      expect(body).toMatchObject({
        success: true,
        data: {
          instances: [
            expect.objectContaining({
              id: 'broker-instance-disabled',
              metadata: expect.objectContaining({ fallbackSource: 'broker-snapshot' }),
            }),
          ],
        },
        meta: expect.objectContaining({ storageFallback: true }),
      });
    } finally {
      await stopTestServer(server);
    }
  });

  it('creates a WhatsApp instance', async () => {
  });

  it('creates a WhatsApp instance preservando o identificador literal', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const { prisma } = await import('../lib/prisma');
    const { whatsappBrokerClient } = await import('../services/whatsapp-broker-client');

    const friendlyName = 'WhatsApp Principal';
    const identifier = 'WhatsApp Principal';
    const brokerInstance = {
      id: identifier,
      tenantId: 'tenant-123',
      name: friendlyName,
      status: 'connecting' as const,
      connected: false,
      phoneNumber: '+5511987654321',
    };

    const createInstanceSpy = vi
      .spyOn(whatsappBrokerClient, 'createInstance')
      .mockResolvedValue(brokerInstance);

    prisma.whatsAppInstance.create.mockImplementation(async ({ data }) => {
      expect(data).toMatchObject({
        id: identifier,
        tenantId: 'tenant-123',
        name: friendlyName,
        brokerId: identifier,
        status: 'connecting',
        connected: false,
        phoneNumber: '+5511987654321',
        metadata: expect.objectContaining({
          displayId: identifier,
          slug: identifier,
          brokerId: identifier,
          displayName: friendlyName,
          label: friendlyName,
        }),
      });

      return {
        id: data.id,
        tenantId: data.tenantId,
        name: data.name,
        brokerId: data.brokerId,
        phoneNumber: data.phoneNumber,
        status: data.status,
        connected: data.connected,
        lastSeenAt: null,
        createdAt: new Date('2024-01-05T00:00:00.000Z'),
        updatedAt: new Date('2024-01-05T00:00:00.000Z'),
        metadata: data.metadata,
      } as Awaited<ReturnType<typeof prisma.whatsAppInstance.create>>;
    });

    try {
      const response = await fetch(`${url}/api/integrations/whatsapp/instances`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-tenant-id': 'tenant-123',
        },
        body: JSON.stringify({ name: friendlyName }),
      });

      const body = await response.json();

      expect(prisma.whatsAppInstance.findFirst).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-123', id: identifier },
        select: { id: true },
      });
      expect(createInstanceSpy).toHaveBeenCalledWith({
        tenantId: 'tenant-123',
        name: friendlyName,
        instanceId: identifier,
      });
      expect(prisma.whatsAppInstance.create).toHaveBeenCalledWith({
        data: {
          id: identifier,
          tenantId: 'tenant-123',
          name: friendlyName,
          brokerId: identifier,
          status: 'connecting',
          connected: false,
          phoneNumber: '+5511987654321',
          metadata: expect.objectContaining({
            displayId: identifier,
            slug: identifier,
            brokerId: identifier,
            displayName: friendlyName,
            label: friendlyName,
            history: expect.arrayContaining([
              expect.objectContaining({ action: 'created', by: 'user-1' }),
            ]),
          }),
        },
      });
      expect(response.status).toBe(201);
      expect(body).toMatchObject({
        success: true,
        data: {
          id: identifier,
          name: friendlyName,
          status: 'connecting',
          connected: false,
        },
      });
    } finally {
      await stopTestServer(server);
    }
  });

  it('permite identificadores com maiúsculas e espaços', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const { prisma } = await import('../lib/prisma');
    const { whatsappBrokerClient } = await import('../services/whatsapp-broker-client');

    const friendlyName = 'WhatsApp Principal';
    const identifier = 'Minha Loja X';

    const createInstanceSpy = vi
      .spyOn(whatsappBrokerClient, 'createInstance')
      .mockResolvedValue({
        id: identifier,
        tenantId: 'tenant-123',
        name: friendlyName,
        status: 'connecting',
        connected: false,
      });

    prisma.whatsAppInstance.create.mockImplementation(async ({ data }) => {
      expect(data.id).toBe(identifier);
      expect(data.metadata).toMatchObject({
        displayId: identifier,
        slug: identifier,
      });

      return {
        id: data.id,
        tenantId: data.tenantId,
        name: data.name,
        brokerId: data.brokerId,
        phoneNumber: data.phoneNumber ?? null,
        status: data.status,
        connected: data.connected,
        lastSeenAt: null,
        createdAt: new Date('2024-01-05T00:00:00.000Z'),
        updatedAt: new Date('2024-01-05T00:00:00.000Z'),
        metadata: data.metadata,
      } as Awaited<ReturnType<typeof prisma.whatsAppInstance.create>>;
    });

    try {
      const response = await fetch(`${url}/api/integrations/whatsapp/instances`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-tenant-id': 'tenant-123',
        },
        body: JSON.stringify({ name: friendlyName, id: identifier }),
      });

      const body = await response.json();

      expect(prisma.whatsAppInstance.findFirst).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-123', id: identifier },
        select: { id: true },
      });
      expect(createInstanceSpy).toHaveBeenCalledWith({
        tenantId: 'tenant-123',
        name: friendlyName,
        instanceId: identifier,
      });
      expect(response.status).toBe(201);
      expect(body).toMatchObject({ success: true });
    } finally {
      await stopTestServer(server);
    }
  });

  it('returns a bad gateway response when the broker rejects instance creation', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const { prisma } = await import('../lib/prisma');
    const { whatsappBrokerClient } = await import('../services/whatsapp-broker-client');

    const brokerError = new WhatsAppBrokerError('Broker error', 'BROKER_FAILURE', 500, 'req-123');
    vi.spyOn(whatsappBrokerClient, 'createInstance').mockRejectedValue(brokerError);

    try {
      const response = await fetch(`${url}/api/integrations/whatsapp/instances`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-tenant-id': 'tenant-123',
        },
        body: JSON.stringify({ name: 'created-instance' }),
      });

      const body = await response.json();

      expect(response.status).toBe(502);
      expect(body).toMatchObject({
        success: false,
        error: {
          code: 'BROKER_FAILURE',
          message: 'Broker error',
          details: { status: 500, requestId: 'req-123' },
        },
      });
      expect(prisma.whatsAppInstance.create).not.toHaveBeenCalled();
    } finally {
      await stopTestServer(server);
    }
  });

  it('retorna conflito quando o identificador já está em uso', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const { prisma } = await import('../lib/prisma');
    const { whatsappBrokerClient } = await import('../services/whatsapp-broker-client');

    const friendlyName = 'WhatsApp Principal';
    vi.spyOn(whatsappBrokerClient, 'createInstance');

    (prisma.whatsAppInstance.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: friendlyName,
    });

    try {
      const response = await fetch(`${url}/api/integrations/whatsapp/instances`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-tenant-id': 'tenant-123',
        },
        body: JSON.stringify({ name: friendlyName }),
      });

      const body = await response.json();

      expect(prisma.whatsAppInstance.findFirst).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-123', id: friendlyName },
        select: { id: true },
      });
      expect(prisma.whatsAppInstance.create).not.toHaveBeenCalled();
      expect(whatsappBrokerClient.createInstance).not.toHaveBeenCalled();
      expect(response.status).toBe(409);
      expect(body).toMatchObject({
        success: false,
        error: { code: 'INSTANCE_ALREADY_EXISTS' },
      });
    } finally {
      await stopTestServer(server);
    }
  });

  it('returns service unavailable when persistence lookups fail while creating an instance', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const { prisma } = await import('../lib/prisma');

    const prismaError = Object.assign(new Error('whatsapp_instances table does not exist'), {
      code: 'P2021',
      clientVersion: '5.0.0',
    });

    (prisma.whatsAppInstance.findFirst as ReturnType<typeof vi.fn>).mockRejectedValueOnce(prismaError);

    try {
      const response = await fetch(`${url}/api/integrations/whatsapp/instances`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-tenant-id': 'tenant-123',
        },
        body: JSON.stringify({ name: 'new-instance' }),
      });

      const body = await response.json();

      expect(response.status).toBe(503);
      expect(body).toMatchObject({
        success: false,
        error: {
          code: 'WHATSAPP_STORAGE_UNAVAILABLE',
        },
      });
    } finally {
      await stopTestServer(server);
    }
  });

  it('returns database disabled when persistence is disabled while creating an instance', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const { prisma } = await import('../lib/prisma');

    (prisma.whatsAppInstance.findFirst as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      createDatabaseDisabledError()
    );

    try {
      const response = await fetch(`${url}/api/integrations/whatsapp/instances`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-tenant-id': 'tenant-123',
        },
        body: JSON.stringify({ name: 'new-instance' }),
      });

      const body = await response.json();

      expect(response.status).toBe(503);
      expect(body).toMatchObject({
        success: false,
        error: {
          code: 'DATABASE_DISABLED',
        },
      });
    } finally {
      await stopTestServer(server);
    }
  });

  it('returns latest snapshot without triggering broker pairing when no phone number is provided', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const { prisma } = await import('../lib/prisma');
    const { whatsappBrokerClient } = await import('../services/whatsapp-broker-client');

    let storedInstance = {
      id: 'instance-3',
      tenantId: 'tenant-123',
      name: 'Instance 3',
      brokerId: 'broker-3',
      phoneNumber: null,
      status: 'disconnected',
      connected: false,
      lastSeenAt: null,
      createdAt: new Date('2024-01-06T00:00:00.000Z'),
      updatedAt: new Date('2024-01-06T00:00:00.000Z'),
      metadata: { history: [] },
    } as Awaited<ReturnType<typeof prisma.whatsAppInstance.findFirst>>;

    prisma.whatsAppInstance.findFirst.mockResolvedValue(storedInstance);
    prisma.whatsAppInstance.findMany.mockImplementation(async () => [storedInstance]);
    prisma.whatsAppInstance.update.mockImplementation(async ({ data, where }) => {
      if (where.id === storedInstance.id) {
        storedInstance = {
          ...storedInstance,
          ...data,
          metadata: data.metadata ?? storedInstance.metadata,
        } as typeof storedInstance;
      }

      return storedInstance as Awaited<ReturnType<typeof prisma.whatsAppInstance.update>>;
    });

    const connectSpy = vi.spyOn(whatsappBrokerClient, 'connectInstance').mockResolvedValue();
    const listSpy = vi.spyOn(whatsappBrokerClient, 'listInstances').mockResolvedValue([
      {
        instance: {
          id: 'broker-3',
          tenantId: 'tenant-123',
          name: 'Instance 3',
          status: 'connected',
          connected: true,
          phoneNumber: '+5511999999999',
          stats: { totalSent: 5 },
        },
        status: {
          status: 'connected',
          connected: true,
          qr: null,
          qrCode: null,
          qrExpiresAt: null,
          expiresAt: null,
          stats: { totalSent: 5 },
          metrics: { sent: 5 },
          messages: { sent: 5 },
          rate: { limit: 50, remaining: 45, resetAt: '2024-01-06T01:00:00.000Z' },
          rateUsage: { limit: 50, used: 5 },
          raw: { stats: { totalSent: 5 } },
        },
      },
    ]);

    try {
      const response = await fetch(
        `${url}/api/integrations/whatsapp/instances/instance-3/pair`,
        {
          method: 'POST',
          headers: {
            'x-tenant-id': 'tenant-123',
          },
        }
      );

      const body = await response.json();

      expect(connectSpy).not.toHaveBeenCalled();
      expect(listSpy).toHaveBeenCalledWith('tenant-123');
      expect(prisma.whatsAppInstance.update).toHaveBeenCalledWith({
        where: { id: 'instance-3' },
        data: expect.objectContaining({ status: 'connected', connected: true }),
      });
      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        success: true,
        data: {
          connected: false,
          status: expect.objectContaining({ status: 'disconnected', connected: false }),
          instance: expect.objectContaining({
            id: 'instance-3',
            status: 'connected',
            connected: true,
            phoneNumber: '+5511999999999',
            metadata: expect.objectContaining({
              lastBrokerSnapshot: expect.objectContaining({
                status: 'connected',
                connected: true,
              }),
            }),
          }),
          instances: expect.arrayContaining([
            expect.objectContaining({ id: 'instance-3', status: 'connected' }),
          ]),
        },
      });
    } finally {
      await stopTestServer(server);
    }
  });

  it('requests broker pairing when a phone number is provided', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const { prisma } = await import('../lib/prisma');
    const { whatsappBrokerClient } = await import('../services/whatsapp-broker-client');

    let storedInstance = {
      id: 'instance-4',
      tenantId: 'tenant-123',
      name: 'Instance 4',
      brokerId: 'broker-4',
      phoneNumber: null,
      status: 'disconnected',
      connected: false,
      lastSeenAt: null,
      createdAt: new Date('2024-01-07T00:00:00.000Z'),
      updatedAt: new Date('2024-01-07T00:00:00.000Z'),
      metadata: { history: [] },
    } as Awaited<ReturnType<typeof prisma.whatsAppInstance.findFirst>>;

    prisma.whatsAppInstance.findFirst.mockResolvedValue(storedInstance);
    prisma.whatsAppInstance.findMany.mockImplementation(async () => [storedInstance]);
    prisma.whatsAppInstance.update.mockImplementation(async ({ data, where }) => {
      if (where.id === storedInstance.id) {
        storedInstance = {
          ...storedInstance,
          ...data,
          metadata: (data.metadata ?? storedInstance.metadata) as typeof storedInstance.metadata,
        } as typeof storedInstance;
      }

      return storedInstance as Awaited<ReturnType<typeof prisma.whatsAppInstance.update>>;
    });

    const connectSpy = vi.spyOn(whatsappBrokerClient, 'connectInstance').mockResolvedValue();
    const listSpy = vi.spyOn(whatsappBrokerClient, 'listInstances').mockResolvedValue([
      {
        instance: {
          id: 'broker-4',
          tenantId: 'tenant-123',
          name: 'Instance 4',
          status: 'connecting',
          connected: false,
          phoneNumber: '+5511999999999',
        },
        status: {
          status: 'connecting',
          connected: false,
          qr: null,
          qrCode: null,
          qrExpiresAt: null,
          expiresAt: null,
          stats: null,
          metrics: null,
          messages: null,
          rate: null,
          rateUsage: null,
          raw: null,
        },
      },
    ]);

    const phoneInput = '(11) 99999-9999';
    const expectedPhoneNumber = normalizePhoneNumber(phoneInput).e164;

    try {
      const response = await fetch(
        `${url}/api/integrations/whatsapp/instances/instance-4/pair`,
        {
          method: 'POST',
          headers: {
            'x-tenant-id': 'tenant-123',
            'content-type': 'application/json',
          },
          body: JSON.stringify({ phoneNumber: phoneInput }),
        }
      );

      const body = await response.json();

      expect(connectSpy).toHaveBeenCalledWith('broker-4', {
        instanceId: 'instance-4',
        phoneNumber: expectedPhoneNumber,
      });
      expect(listSpy).toHaveBeenCalledWith('tenant-123');
      expect(response.status).toBe(200);
      expect(body).toMatchObject({ success: true });

      const updateArgs = prisma.whatsAppInstance.update.mock.calls.at(-1)?.[0];
      expect(updateArgs?.data?.metadata).toEqual(
        expect.objectContaining({
          history: expect.arrayContaining([
            expect.objectContaining({ phoneNumber: expectedPhoneNumber }),
          ]),
        })
      );
    } finally {
      await stopTestServer(server);
    }
  });

  it('connects a WhatsApp instance when identifier is URL-encoded', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const { prisma } = await import('../lib/prisma');
    const { whatsappBrokerClient } = await import('../services/whatsapp-broker-client');

    const decodedId = '554199999999:18@s.whatsapp.net';
    const encodedId = encodeURIComponent(decodedId);

    let storedInstance = {
      id: decodedId,
      tenantId: 'tenant-123',
      name: 'JID Instance',
      brokerId: decodedId,
      phoneNumber: '+554199999999',
      status: 'disconnected',
      connected: false,
      lastSeenAt: null,
      createdAt: new Date('2024-01-07T00:00:00.000Z'),
      updatedAt: new Date('2024-01-07T00:00:00.000Z'),
      metadata: { history: [] },
    } as Awaited<ReturnType<typeof prisma.whatsAppInstance.findFirst>>;

    prisma.whatsAppInstance.findFirst.mockResolvedValue(storedInstance);
    prisma.whatsAppInstance.findMany.mockImplementation(async () => [storedInstance]);
    prisma.whatsAppInstance.update.mockImplementation(async ({ data, where }) => {
      if (where.id === storedInstance.id) {
        storedInstance = {
          ...storedInstance,
          ...data,
          metadata: data.metadata ?? storedInstance.metadata,
        } as typeof storedInstance;
      }

      return storedInstance as Awaited<ReturnType<typeof prisma.whatsAppInstance.update>>;
    });

    const connectSpy = vi.spyOn(whatsappBrokerClient, 'connectInstance').mockResolvedValue();
    const listSpy = vi.spyOn(whatsappBrokerClient, 'listInstances').mockResolvedValue([
      {
        instance: {
          id: decodedId,
          tenantId: 'tenant-123',
          name: 'JID Instance',
          status: 'connected',
          connected: true,
          phoneNumber: '+554199999999',
          stats: { totalSent: 1 },
        },
        status: {
          status: 'connected',
          connected: true,
          qr: null,
          qrCode: null,
          qrExpiresAt: null,
          expiresAt: null,
          stats: { totalSent: 1 },
          metrics: null,
          messages: null,
          rate: null,
          rateUsage: null,
          raw: null,
        },
      },
    ]);

    try {
      const response = await fetch(
        `${url}/api/integrations/whatsapp/instances/${encodedId}/pair`,
        {
          method: 'POST',
          headers: {
            'x-tenant-id': 'tenant-123',
          },
        }
      );

      const body = await response.json();

      expect(prisma.whatsAppInstance.findFirst).toHaveBeenCalledWith({
        where: { id: decodedId },
      });
      expect(connectSpy).not.toHaveBeenCalled();
      expect(listSpy).toHaveBeenCalledWith('tenant-123');
      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          instance: expect.objectContaining({ id: decodedId }),
        }),
      });
    } finally {
      await stopTestServer(server);
    }
  });

  it('returns success when broker reports session already connected', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const { prisma } = await import('../lib/prisma');
    const { whatsappBrokerClient } = await import('../services/whatsapp-broker-client');

    let storedInstance = {
      id: 'instance-already',
      tenantId: 'tenant-123',
      name: 'Instance Already Connected',
      brokerId: 'broker-already',
      phoneNumber: '+5511988880000',
      status: 'connecting',
      connected: false,
      lastSeenAt: null,
      createdAt: new Date('2024-01-08T00:00:00.000Z'),
      updatedAt: new Date('2024-01-08T00:00:00.000Z'),
      metadata: { history: [] },
    } as Awaited<ReturnType<typeof prisma.whatsAppInstance.findFirst>>;

    prisma.whatsAppInstance.findFirst.mockResolvedValue(storedInstance);
    prisma.whatsAppInstance.findMany.mockImplementation(async () => [storedInstance]);
    prisma.whatsAppInstance.update.mockImplementation(async ({ data, where }) => {
      if (where.id === storedInstance.id) {
        storedInstance = {
          ...storedInstance,
          ...data,
          metadata: data.metadata ?? storedInstance.metadata,
        } as typeof storedInstance;
      }

      return storedInstance as Awaited<ReturnType<typeof prisma.whatsAppInstance.update>>;
    });

    const connectError = new WhatsAppBrokerError('Already connected', 'SESSION_ALREADY_CONNECTED', 409);
    const connectSpy = vi.spyOn(whatsappBrokerClient, 'connectInstance').mockRejectedValue(connectError);
    const listSpy = vi.spyOn(whatsappBrokerClient, 'listInstances').mockResolvedValue([
      {
        instance: {
          id: 'broker-already',
          tenantId: 'tenant-123',
          name: 'Instance Already Connected',
          status: 'connected',
          connected: true,
          phoneNumber: '+5511988880000',
          stats: { totalSent: 2 },
        },
        status: {
          status: 'connected',
          connected: true,
          qr: null,
          qrCode: null,
          qrExpiresAt: null,
          expiresAt: null,
          stats: { totalSent: 2 },
          metrics: null,
          messages: null,
          rate: null,
          rateUsage: null,
          raw: null,
        },
      },
    ]);

    try {
      const response = await fetch(
        `${url}/api/integrations/whatsapp/instances/instance-already/pair`,
        {
          method: 'POST',
          headers: {
            'x-tenant-id': 'tenant-123',
          },
        }
      );

      const body = await response.json();

      expect(connectSpy).not.toHaveBeenCalled();
      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        success: true,
        data: {
          connected: false,
          status: expect.objectContaining({ status: 'disconnected', connected: false }),
        },
      });
    } finally {
      await stopTestServer(server);
    }
  });

  it('disconnects a WhatsApp instance', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const { prisma } = await import('../lib/prisma');
    const { whatsappBrokerClient } = await import('../services/whatsapp-broker-client');

    let storedInstance = {
      id: 'instance-4',
      tenantId: 'tenant-123',
      name: 'Instance 4',
      brokerId: 'broker-4',
      phoneNumber: '+5511988888888',
      status: 'connected',
      connected: true,
      lastSeenAt: new Date('2024-01-07T00:00:00.000Z'),
      createdAt: new Date('2024-01-06T00:00:00.000Z'),
      updatedAt: new Date('2024-01-06T00:00:00.000Z'),
      metadata: { history: [] },
    } as Awaited<ReturnType<typeof prisma.whatsAppInstance.findFirst>>;

    prisma.whatsAppInstance.findFirst.mockResolvedValue(storedInstance);
    prisma.whatsAppInstance.findMany.mockImplementation(async () => [storedInstance]);
    prisma.whatsAppInstance.update.mockImplementation(async ({ data, where }) => {
      if (where.id === storedInstance.id) {
        storedInstance = {
          ...storedInstance,
          ...data,
          metadata: data.metadata ?? storedInstance.metadata,
        } as typeof storedInstance;
      }

      return storedInstance as Awaited<ReturnType<typeof prisma.whatsAppInstance.update>>;
    });

    const disconnectSpy = vi
      .spyOn(whatsappBrokerClient, 'disconnectInstance')
      .mockResolvedValue();
    const listSpy = vi.spyOn(whatsappBrokerClient, 'listInstances').mockResolvedValue([
      {
        instance: {
          id: 'broker-4',
          tenantId: 'tenant-123',
          name: 'Instance 4',
          status: 'disconnected',
          connected: false,
          phoneNumber: '+5511988888888',
        },
        status: {
          status: 'disconnected',
          connected: false,
          qr: null,
          qrCode: null,
          qrExpiresAt: null,
          expiresAt: null,
          stats: { failed: 1 },
          metrics: { failed: 1 },
          messages: null,
          rate: { limit: 50, remaining: 50, resetAt: '2024-01-07T01:00:00.000Z' },
          rateUsage: { limit: 50, used: 0 },
          raw: { stats: { failed: 1 } },
        },
      },
    ]);

    try {
      const response = await fetch(
        `${url}/api/integrations/whatsapp/instances/instance-4/stop`,
        {
          method: 'POST',
          headers: {
            'x-tenant-id': 'tenant-123',
          },
        }
      );

      const body = await response.json();

      expect(disconnectSpy).toHaveBeenCalledWith('broker-4', { instanceId: 'instance-4' });
      expect(listSpy).toHaveBeenCalledWith('tenant-123');
      expect(prisma.whatsAppInstance.update).toHaveBeenCalledWith({
        where: { id: 'instance-4' },
        data: expect.objectContaining({ status: 'disconnected', connected: false }),
      });
      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        success: true,
        data: {
          connected: false,
          status: expect.objectContaining({ status: 'disconnected', connected: false }),
          instance: expect.objectContaining({
            id: 'instance-4',
            status: 'disconnected',
            connected: false,
            phoneNumber: '+5511988888888',
          }),
          instances: expect.arrayContaining([
            expect.objectContaining({ id: 'instance-4', status: 'disconnected' }),
          ]),
        },
      });
    } finally {
      await stopTestServer(server);
    }
  });

  it.each([
    { wipe: true },
    { wipe: false },
  ])('disconnects a WhatsApp instance with wipe %s', async ({ wipe }) => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const { prisma } = await import('../lib/prisma');
    const { whatsappBrokerClient } = await import('../services/whatsapp-broker-client');

    let storedInstance = {
      id: 'instance-5',
      tenantId: 'tenant-123',
      name: 'Instance 5',
      brokerId: 'broker-5',
      phoneNumber: '+5511977777777',
      status: 'connected',
      connected: true,
      lastSeenAt: new Date('2024-01-08T00:00:00.000Z'),
      createdAt: new Date('2024-01-07T00:00:00.000Z'),
      updatedAt: new Date('2024-01-07T00:00:00.000Z'),
      metadata: { history: [] },
    } as Awaited<ReturnType<typeof prisma.whatsAppInstance.findFirst>>;

    prisma.whatsAppInstance.findFirst.mockResolvedValue(storedInstance);
    prisma.whatsAppInstance.findMany.mockImplementation(async () => [storedInstance]);
    prisma.whatsAppInstance.update.mockImplementation(async ({ data, where }) => {
      if (where.id === storedInstance.id) {
        storedInstance = {
          ...storedInstance,
          ...data,
          metadata: data.metadata ?? storedInstance.metadata,
        } as typeof storedInstance;
      }

      return storedInstance as Awaited<ReturnType<typeof prisma.whatsAppInstance.update>>;
    });

    const disconnectSpy = vi
      .spyOn(whatsappBrokerClient, 'disconnectInstance')
      .mockResolvedValue();
    const listSpy = vi.spyOn(whatsappBrokerClient, 'listInstances').mockResolvedValue([
      {
        instance: {
          id: 'broker-5',
          tenantId: 'tenant-123',
          name: 'Instance 5',
          status: 'disconnected',
          connected: false,
          phoneNumber: '+5511977777777',
        },
        status: {
          status: 'disconnected',
          connected: false,
          qr: null,
          qrCode: null,
          qrExpiresAt: null,
          expiresAt: null,
          stats: null,
          metrics: null,
          messages: null,
          rate: { limit: 80, remaining: 80, resetAt: '2024-01-07T02:00:00.000Z' },
          rateUsage: { limit: 80, used: 0 },
          raw: null,
        },
      },
    ]);

    try {
      const response = await fetch(
        `${url}/api/integrations/whatsapp/instances/instance-5/stop`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-tenant-id': 'tenant-123',
          },
          body: JSON.stringify({ wipe }),
        }
      );

      const body = await response.json();

      expect(disconnectSpy).toHaveBeenCalledWith('broker-5', { instanceId: 'instance-5', wipe });
      expect(listSpy).toHaveBeenCalledWith('tenant-123');
      expect(prisma.whatsAppInstance.update).toHaveBeenCalledWith({
        where: { id: 'instance-5' },
        data: expect.objectContaining({ status: 'disconnected', connected: false }),
      });
      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        success: true,
        data: {
          connected: false,
          status: expect.objectContaining({ status: 'disconnected', connected: false }),
          qr: { qr: null, qrCode: null, qrExpiresAt: null, expiresAt: null },
          instance: expect.objectContaining({ id: 'instance-5', status: 'disconnected' }),
          instances: expect.arrayContaining([
            expect.objectContaining({ id: 'instance-5', status: 'disconnected' }),
          ]),
        },
      });
    } finally {
      await stopTestServer(server);
    }
  });

  it('returns success when broker reports instance already disconnected', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const { prisma } = await import('../lib/prisma');
    const { whatsappBrokerClient } = await import('../services/whatsapp-broker-client');

    let storedInstance = {
      id: 'instance-disconnected',
      tenantId: 'tenant-123',
      name: 'Instance Disconnected',
      brokerId: 'broker-disconnected',
      phoneNumber: '+551197770000',
      status: 'connected',
      connected: true,
      lastSeenAt: new Date('2024-01-08T00:00:00.000Z'),
      createdAt: new Date('2024-01-07T00:00:00.000Z'),
      updatedAt: new Date('2024-01-07T00:00:00.000Z'),
      metadata: { history: [] },
    } as Awaited<ReturnType<typeof prisma.whatsAppInstance.findFirst>>;

    prisma.whatsAppInstance.findFirst.mockResolvedValue(storedInstance);
    prisma.whatsAppInstance.findMany.mockImplementation(async () => [storedInstance]);
    prisma.whatsAppInstance.update.mockImplementation(async ({ data, where }) => {
      if (where.id === storedInstance.id) {
        storedInstance = {
          ...storedInstance,
          ...data,
          metadata: data.metadata ?? storedInstance.metadata,
        } as typeof storedInstance;
      }

      return storedInstance as Awaited<ReturnType<typeof prisma.whatsAppInstance.update>>;
    });

    const disconnectError = new WhatsAppBrokerError(
      'Already disconnected',
      'SESSION_ALREADY_LOGGED_OUT',
      409
    );
    const disconnectSpy = vi
      .spyOn(whatsappBrokerClient, 'disconnectInstance')
      .mockRejectedValue(disconnectError);
    const listSpy = vi.spyOn(whatsappBrokerClient, 'listInstances').mockResolvedValue([
      {
        instance: {
          id: 'broker-disconnected',
          tenantId: 'tenant-123',
          name: 'Instance Disconnected',
          status: 'disconnected',
          connected: false,
        },
        status: {
          status: 'disconnected',
          connected: false,
          qr: null,
          qrCode: null,
          qrExpiresAt: null,
          expiresAt: null,
          stats: null,
          metrics: null,
          messages: null,
          rate: null,
          rateUsage: null,
          raw: null,
        },
      },
    ]);

    try {
      const response = await fetch(
        `${url}/api/integrations/whatsapp/instances/instance-disconnected/stop`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-tenant-id': 'tenant-123',
          },
          body: JSON.stringify({ wipe: false }),
        }
      );

      const body = await response.json();

      expect(disconnectSpy).toHaveBeenCalledWith('broker-disconnected', {
        instanceId: 'instance-disconnected',
        wipe: false,
      });
      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        success: true,
        data: {
          connected: false,
          status: expect.objectContaining({ status: 'disconnected', connected: false }),
        },
      });
    } finally {
      await stopTestServer(server);
    }
  });

  it.each([
    { wipe: true },
    { wipe: false },
  ])('disconnects the default WhatsApp instance with wipe %s', async ({ wipe }) => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const { whatsappBrokerClient } = await import('../services/whatsapp-broker-client');
    const { prisma } = await import('../lib/prisma');

    let storedInstance = {
      id: 'leadengine',
      tenantId: 'tenant-123',
      name: 'Default Instance',
      brokerId: 'leadengine',
      phoneNumber: '+5511987654321',
      status: 'connected',
      connected: true,
      lastSeenAt: new Date('2024-01-01T00:00:00.000Z'),
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
      metadata: { history: [] },
    } as Awaited<ReturnType<typeof prisma.whatsAppInstance.findFirst>>;

    prisma.whatsAppInstance.findFirst.mockResolvedValue(storedInstance);
    prisma.whatsAppInstance.findMany.mockImplementation(async () => [storedInstance]);
    prisma.whatsAppInstance.update.mockImplementation(async ({ data, where }) => {
      if (where.id === storedInstance.id) {
        storedInstance = {
          ...storedInstance,
          ...data,
          metadata: data.metadata ?? storedInstance.metadata,
        } as typeof storedInstance;
      }

      return storedInstance as Awaited<ReturnType<typeof prisma.whatsAppInstance.update>>;
    });

    const disconnectSpy = vi
      .spyOn(whatsappBrokerClient, 'disconnectInstance')
      .mockResolvedValue();
    const listSpy = vi.spyOn(whatsappBrokerClient, 'listInstances').mockResolvedValue([
      {
        instance: {
          id: 'leadengine',
          tenantId: 'tenant-123',
          name: 'Default Instance',
          status: 'disconnected',
          connected: false,
          phoneNumber: '+5511987654321',
        },
        status: {
          status: 'disconnected',
          connected: false,
          qr: null,
          qrCode: null,
          qrExpiresAt: null,
          expiresAt: null,
          stats: null,
          metrics: null,
          messages: null,
          rate: null,
          rateUsage: null,
          raw: null,
        },
      },
    ]);

    try {
      const response = await fetch(
        `${url}/api/integrations/whatsapp/instances/disconnect`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-tenant-id': 'tenant-123',
          },
          body: JSON.stringify({ wipe }),
        }
      );

      const body = await response.json();

      expect(disconnectSpy).toHaveBeenCalledWith('leadengine', {
        instanceId: 'leadengine',
        wipe,
      });
      expect(listSpy).toHaveBeenCalledWith('tenant-123');
      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        success: true,
        data: {
          connected: false,
          status: expect.objectContaining({ status: 'disconnected', connected: false }),
          qr: { qr: null, qrCode: null, qrExpiresAt: null, expiresAt: null },
          instance: expect.objectContaining({ id: 'leadengine', status: 'disconnected' }),
          instances: expect.arrayContaining([
            expect.objectContaining({ id: 'leadengine', status: 'disconnected' }),
          ]),
        },
      });
    } finally {
      await stopTestServer(server);
    }
  });

  it('returns a descriptive error when deleting a broker session via DELETE', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const { prisma } = await import('../lib/prisma');

    try {
      const jid = '5541999888777:12@s.whatsapp.net';
      const response = await fetch(
        `${url}/api/integrations/whatsapp/instances/${encodeURIComponent(jid)}`,
        {
          method: 'DELETE',
          headers: {
            'x-tenant-id': 'tenant-123',
          },
        }
      );

      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body).toMatchObject({
        success: false,
        error: { code: 'USE_DISCONNECT_FOR_JID' },
      });
      expect(prisma.whatsAppInstance.findFirst).not.toHaveBeenCalled();
    } finally {
      await stopTestServer(server);
    }
  });

  it('deletes a WhatsApp instance permanently', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const { prisma } = await import('../lib/prisma');
    const { whatsappBrokerClient } = await import('../services/whatsapp-broker-client');
    const inboundLeadService = await import('../features/whatsapp-inbound/services/inbound-lead-service');

    const invalidateCampaignCacheSpy = vi
      .spyOn(inboundLeadService, 'invalidateCampaignCache')
      .mockImplementation(() => {});

    const storedInstance: PrismaWhatsAppInstance = {
      id: 'instance-delete',
      tenantId: 'tenant-123',
      name: 'Instance to delete',
      brokerId: 'broker-delete',
      phoneNumber: '+5511999999999',
      status: 'connected',
      connected: true,
      lastSeenAt: new Date('2024-01-01T00:00:00.000Z'),
      createdAt: new Date('2023-12-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-05T00:00:00.000Z'),
      metadata: {
        history: [{ action: 'created', by: 'user-1', at: '2024-01-05T00:00:00.000Z' }],
      } as Prisma.JsonValue,
    };

    prisma.whatsAppInstance.findFirst.mockResolvedValue(storedInstance);
    prisma.whatsAppInstance.findMany.mockResolvedValueOnce([storedInstance]).mockResolvedValue([]);
    prisma.campaign.updateMany.mockResolvedValue({ count: 2 } as any);
    prisma.whatsAppSession.deleteMany.mockResolvedValue({ count: 1 } as any);
    prisma.whatsAppInstance.delete.mockResolvedValue(storedInstance);
    prisma.integrationState.upsert.mockResolvedValue(null as any);

    const deleteSpy = vi.spyOn(whatsappBrokerClient, 'deleteInstance').mockResolvedValue();

    try {
      const response = await fetch(
        `${url}/api/integrations/whatsapp/instances/${storedInstance.id}?wipe=true`,
        {
          method: 'DELETE',
          headers: {
            'x-tenant-id': 'tenant-123',
          },
        }
      );

      const body = await response.json();

      expect(deleteSpy).toHaveBeenCalledWith('broker-delete', {
        instanceId: 'instance-delete',
        wipe: true,
      });
      expect(prisma.campaign.updateMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-123', whatsappInstanceId: 'instance-delete' },
        data: { whatsappInstanceId: null },
      });
      expect(prisma.whatsAppSession.deleteMany).toHaveBeenCalledWith({
        where: { instanceId: 'instance-delete' },
      });
      expect(prisma.whatsAppInstance.delete).toHaveBeenCalledWith({
        where: { id: 'instance-delete' },
      });
      expect(prisma.integrationState.upsert).toHaveBeenCalledTimes(2);
      const upsertKeys = prisma.integrationState.upsert.mock.calls.map(
        (call) => call[0]?.where?.key
      );
      expect(upsertKeys).toEqual(
        expect.arrayContaining([
          expect.stringContaining('instance-delete'),
          expect.stringContaining('broker-delete'),
        ])
      );
      expect(invalidateCampaignCacheSpy).toHaveBeenCalledWith('tenant-123', 'instance-delete');
      expect(emitToTenantMock).toHaveBeenCalledWith(
        'tenant-123',
        'whatsapp.instances.deleted',
        expect.objectContaining({ id: 'instance-delete' })
      );
      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        success: true,
        data: {
          id: 'instance-delete',
          brokerStatus: 'deleted',
          instances: [],
        },
      });
    } finally {
      invalidateCampaignCacheSpy.mockRestore();
      await stopTestServer(server);
    }
  });

  it('continues deletion when broker reports missing session', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const { prisma } = await import('../lib/prisma');
    const { whatsappBrokerClient } = await import('../services/whatsapp-broker-client');

    const storedInstance: PrismaWhatsAppInstance = {
      id: 'instance-missing-broker',
      tenantId: 'tenant-123',
      name: 'Instance missing',
      brokerId: 'broker-missing',
      phoneNumber: null,
      status: 'disconnected',
      connected: false,
      lastSeenAt: null,
      createdAt: new Date('2023-12-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-05T00:00:00.000Z'),
      metadata: { history: [] } as Prisma.JsonValue,
    };

    prisma.whatsAppInstance.findFirst.mockResolvedValue(storedInstance);
    prisma.whatsAppInstance.findMany.mockResolvedValueOnce([storedInstance]).mockResolvedValue([]);
    prisma.campaign.updateMany.mockResolvedValue({ count: 0 } as any);
    prisma.whatsAppSession.deleteMany.mockResolvedValue({ count: 0 } as any);
    prisma.whatsAppInstance.delete.mockResolvedValue(storedInstance);
    prisma.integrationState.upsert.mockResolvedValue(null as any);

    const brokerError = new WhatsAppBrokerError('not found', {
      status: 404,
      code: 'INSTANCE_NOT_FOUND',
    } as any);

    const deleteSpy = vi
      .spyOn(whatsappBrokerClient, 'deleteInstance')
      .mockRejectedValue(brokerError);

    try {
      const response = await fetch(
        `${url}/api/integrations/whatsapp/instances/${storedInstance.id}`,
        {
          method: 'DELETE',
          headers: {
            'x-tenant-id': 'tenant-123',
          },
        }
      );

      const body = await response.json();

      expect(deleteSpy).toHaveBeenCalled();
      expect(prisma.whatsAppInstance.delete).toHaveBeenCalledWith({
        where: { id: 'instance-missing-broker' },
      });
      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        success: true,
        data: {
          id: 'instance-missing-broker',
          brokerStatus: 'not_found',
        },
      });
    } finally {
      await stopTestServer(server);
    }
  });

  it('disconnects broker-only sessions via the dedicated route and tolerates missing instances', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const { whatsappBrokerClient } = await import('../services/whatsapp-broker-client');

    const jid = '5511987654321:55@s.whatsapp.net';
    const disconnectSpy = vi
      .spyOn(whatsappBrokerClient, 'disconnectInstance')
      .mockRejectedValue(new WhatsAppBrokerError('not found', 'SESSION_NOT_FOUND', 404));

    try {
      const response = await fetch(
        `${url}/api/integrations/whatsapp/instances/${encodeURIComponent(jid)}/disconnect`,
        {
          method: 'POST',
          headers: {
            'x-tenant-id': 'tenant-123',
          },
        }
      );

      const body = await response.json();

      expect(disconnectSpy).toHaveBeenCalledWith(jid, { instanceId: jid });
      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        success: true,
        data: { instanceId: jid, disconnected: true, existed: false },
      });
    } finally {
      await stopTestServer(server);
    }
  });

  it('schedules a retry when broker disconnect fails with a server error', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const { whatsappBrokerClient } = await import('../services/whatsapp-broker-client');
    const { prisma } = await import('../lib/prisma');

    const jid = '558899112233:55@s.whatsapp.net';
    const disconnectError = new WhatsAppBrokerError('Broker unavailable', 'BROKER_UNAVAILABLE', 503, 'req-503');
    const disconnectSpy = vi
      .spyOn(whatsappBrokerClient, 'disconnectInstance')
      .mockRejectedValue(disconnectError);

    prisma.integrationState.findUnique.mockResolvedValue(null);

    try {
      const response = await fetch(
        `${url}/api/integrations/whatsapp/instances/${encodeURIComponent(jid)}/disconnect`,
        {
          method: 'POST',
          headers: {
            'x-tenant-id': 'tenant-123',
          },
        }
      );

      const body = await response.json();

      expect(disconnectSpy).toHaveBeenCalledWith(jid, { instanceId: jid });
      expect(response.status).toBe(202);
      expect(body).toMatchObject({
        success: true,
        data: {
          instanceId: jid,
          disconnected: false,
          pending: true,
          existed: true,
          connected: null,
          retry: {
            status: 503,
            requestId: 'req-503',
          },
        },
      });

      expect(prisma.integrationState.create).toHaveBeenCalledTimes(1);
      expect(prisma.integrationState.update).not.toHaveBeenCalled();

      const createArgs = prisma.integrationState.create.mock.calls[0]?.[0];
      expect(createArgs).toMatchObject({
        data: {
          key: 'whatsapp:disconnect:retry:tenant:tenant-123',
          value: {
            jobs: [
              expect.objectContaining({
                instanceId: jid,
                tenantId: 'tenant-123',
                status: 503,
                requestId: 'req-503',
                wipe: false,
                requestedAt: expect.any(String),
              }),
            ],
          },
        },
      });
    } finally {
      await stopTestServer(server);
    }
  });

  it('schedules a retry when stored instance disconnect fails with a server error', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const { whatsappBrokerClient } = await import('../services/whatsapp-broker-client');
    const { prisma } = await import('../lib/prisma');

    const storedInstance = {
      id: 'instance-retry',
      tenantId: 'tenant-123',
      name: 'Instance Retry',
      brokerId: 'broker-retry',
      phoneNumber: '+5511999999999',
      status: 'connected',
      connected: true,
      lastSeenAt: new Date('2024-01-09T00:00:00.000Z'),
      createdAt: new Date('2024-01-08T00:00:00.000Z'),
      updatedAt: new Date('2024-01-08T00:00:00.000Z'),
      metadata: { history: [] },
    } as Awaited<ReturnType<typeof prisma.whatsAppInstance.findFirst>>;

    prisma.whatsAppInstance.findFirst.mockResolvedValue(storedInstance);
    prisma.whatsAppInstance.findMany.mockResolvedValue([storedInstance]);
    const disconnectError = new WhatsAppBrokerError('Broker unavailable', 'BROKER_UNAVAILABLE', 502, 'req-stored-502');
    const disconnectSpy = vi
      .spyOn(whatsappBrokerClient, 'disconnectInstance')
      .mockRejectedValue(disconnectError);

    prisma.integrationState.findUnique.mockResolvedValue(null);

    try {
      const response = await fetch(
        `${url}/api/integrations/whatsapp/instances/${encodeURIComponent(storedInstance.id)}/disconnect`,
        {
          method: 'POST',
          headers: {
            'x-tenant-id': 'tenant-123',
          },
        }
      );

      const body = await response.json();

      expect(disconnectSpy).toHaveBeenCalledWith('broker-retry', { instanceId: 'instance-retry' });
      expect(response.status).toBe(202);
      expect(body).toMatchObject({
        success: true,
        data: {
          instanceId: 'instance-retry',
          disconnected: false,
          pending: true,
          existed: true,
          connected: null,
          retry: {
            status: 502,
            requestId: 'req-stored-502',
          },
        },
      });

      const createArgs = prisma.integrationState.create.mock.calls[0]?.[0];
      expect(prisma.integrationState.create).toHaveBeenCalledTimes(1);
      expect(prisma.integrationState.update).not.toHaveBeenCalled();
      expect(createArgs).toMatchObject({
        data: {
          key: 'whatsapp:disconnect:retry:tenant:tenant-123',
          value: {
            jobs: [
              expect.objectContaining({
                instanceId: 'instance-retry',
                tenantId: 'tenant-123',
                status: 502,
                requestId: 'req-stored-502',
                wipe: false,
                requestedAt: expect.any(String),
              }),
            ],
          },
        },
      });

      expect(prisma.whatsAppInstance.update).not.toHaveBeenCalled();
    } finally {
      await stopTestServer(server);
    }
  });

  it('fetches a WhatsApp instance QR code', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const { whatsappBrokerClient } = await import('../services/whatsapp-broker-client');
    const { prisma } = await import('../lib/prisma');

    const storedInstance = {
      id: 'instance-5',
      tenantId: 'tenant-123',
      name: 'Instance 5',
      brokerId: 'broker-5',
      phoneNumber: '+5511977777777',
      status: 'connected',
      connected: true,
      lastSeenAt: null,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
      metadata: { history: [] },
    } as Awaited<ReturnType<typeof prisma.whatsAppInstance.findFirst>>;

    prisma.whatsAppInstance.findFirst.mockResolvedValue(storedInstance);
    prisma.whatsAppInstance.findMany.mockResolvedValue([storedInstance]);

    const qrSpy = vi.spyOn(whatsappBrokerClient, 'getQrCode').mockResolvedValue({
      qr: 'data:image/png;base64,QR',
      qrCode: 'data:image/png;base64,QR',
      qrExpiresAt: '2024-01-03T00:00:00.000Z',
      expiresAt: '2024-01-03T00:00:00.000Z',
    });

    try {
      const response = await fetch(
        `${url}/api/integrations/whatsapp/instances/instance-5/qr`,
        {
          method: 'GET',
          headers: {
            'x-tenant-id': 'tenant-123',
          },
        }
      );

      const body = await response.json();

      expect(qrSpy).toHaveBeenCalledWith('broker-5', { instanceId: 'instance-5' });
      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        success: true,
        data: {
          qr: {
            qr: 'data:image/png;base64,QR',
            qrCode: 'data:image/png;base64,QR',
            qrExpiresAt: '2024-01-03T00:00:00.000Z',
            expiresAt: '2024-01-03T00:00:00.000Z',
          },
          instance: expect.objectContaining({ id: 'instance-5' }),
          status: expect.objectContaining({ status: 'disconnected', connected: false }),
          instances: expect.arrayContaining([
            expect.objectContaining({ id: 'instance-5' }),
          ]),
        },
      });
    } finally {
      await stopTestServer(server);
    }
  });

  it('fetches the default WhatsApp instance QR code', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const { whatsappBrokerClient } = await import('../services/whatsapp-broker-client');
    const { prisma } = await import('../lib/prisma');

    const storedInstance = {
      id: 'leadengine',
      tenantId: 'tenant-123',
      name: 'Default Instance',
      brokerId: 'leadengine',
      phoneNumber: '+5511987654321',
      status: 'connected',
      connected: true,
      lastSeenAt: null,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
      metadata: { history: [] },
    } as Awaited<ReturnType<typeof prisma.whatsAppInstance.findFirst>>;

    prisma.whatsAppInstance.findFirst.mockResolvedValue(storedInstance);
    prisma.whatsAppInstance.findMany.mockResolvedValue([storedInstance]);

    const qrSpy = vi.spyOn(whatsappBrokerClient, 'getQrCode').mockResolvedValue({
      qr: 'data:image/png;base64,DEFAULT_QR',
      qrCode: 'data:image/png;base64,DEFAULT_QR',
      qrExpiresAt: null,
      expiresAt: '2024-01-04T00:00:00.000Z',
    });

    try {
      const response = await fetch(`${url}/api/integrations/whatsapp/instances/qr`, {
        method: 'GET',
        headers: {
          'x-tenant-id': 'tenant-123',
        },
      });

      const body = await response.json();

      expect(qrSpy).toHaveBeenCalledWith('leadengine', { instanceId: 'leadengine' });
      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        success: true,
        data: {
          qr: {
            qr: 'data:image/png;base64,DEFAULT_QR',
            qrCode: 'data:image/png;base64,DEFAULT_QR',
            qrExpiresAt: null,
            expiresAt: '2024-01-04T00:00:00.000Z',
          },
          instanceId: 'leadengine',
          instance: expect.objectContaining({ id: 'leadengine' }),
          status: expect.objectContaining({ status: 'disconnected', connected: false }),
          instances: expect.arrayContaining([
            expect.objectContaining({ id: 'leadengine' }),
          ]),
        },
      });
    } finally {
      await stopTestServer(server);
    }
  });

  it('streams a WhatsApp instance QR code as PNG', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const { whatsappBrokerClient } = await import('../services/whatsapp-broker-client');
    const { prisma } = await import('../lib/prisma');

    prisma.whatsAppInstance.findFirst.mockResolvedValue({
      id: 'instance-png',
      tenantId: 'tenant-123',
      name: 'Instance PNG',
      brokerId: 'instance-png',
      phoneNumber: null,
      status: 'disconnected',
      connected: false,
      lastSeenAt: null,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
      metadata: { history: [] },
    } as Awaited<ReturnType<typeof prisma.whatsAppInstance.findFirst>>);

    const qrSpy = vi.spyOn(whatsappBrokerClient, 'getQrCode').mockResolvedValue({
      qr: 'data:image/png;base64,QR',
      qrCode: 'data:image/png;base64,QR',
      qrExpiresAt: '2024-01-05T00:00:00.000Z',
      expiresAt: '2024-01-05T00:00:00.000Z',
    });

    try {
      const response = await fetch(`${url}/api/integrations/whatsapp/instances/instance-png/qr.png`, {
        method: 'GET',
        headers: {
          'x-tenant-id': 'tenant-123',
        },
      });

      const arrayBuffer = await response.arrayBuffer();

      expect(qrSpy).toHaveBeenCalledWith('instance-png', { instanceId: 'instance-png' });
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('image/png');
      expect(Buffer.from(arrayBuffer)).toEqual(Buffer.from('QR', 'base64'));
    } finally {
      await stopTestServer(server);
    }
  });

  it('returns 404 when QR code image is unavailable for an instance', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const { whatsappBrokerClient } = await import('../services/whatsapp-broker-client');
    const { prisma } = await import('../lib/prisma');

    prisma.whatsAppInstance.findFirst.mockResolvedValue({
      id: 'instance-missing',
      tenantId: 'tenant-123',
      name: 'Instance Missing',
      brokerId: 'instance-missing',
      phoneNumber: null,
      status: 'disconnected',
      connected: false,
      lastSeenAt: null,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
      metadata: { history: [] },
    } as Awaited<ReturnType<typeof prisma.whatsAppInstance.findFirst>>);

    vi.spyOn(whatsappBrokerClient, 'getQrCode').mockResolvedValue({
      qr: null,
      qrCode: null,
      qrExpiresAt: null,
      expiresAt: null,
    });

    try {
      const response = await fetch(`${url}/api/integrations/whatsapp/instances/instance-missing/qr.png`, {
        method: 'GET',
        headers: {
          'x-tenant-id': 'tenant-123',
        },
      });

      expect(response.status).toBe(404);
    } finally {
      await stopTestServer(server);
    }
  });

  it('streams the default WhatsApp instance QR code as PNG', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const { whatsappBrokerClient } = await import('../services/whatsapp-broker-client');
    const { prisma } = await import('../lib/prisma');

    prisma.whatsAppInstance.findFirst.mockResolvedValue({
      id: 'leadengine',
      tenantId: 'tenant-123',
      name: 'Default Instance',
      brokerId: 'leadengine',
      phoneNumber: '+5511987654321',
      status: 'connected',
      connected: true,
      lastSeenAt: null,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
      metadata: { history: [] },
    } as Awaited<ReturnType<typeof prisma.whatsAppInstance.findFirst>>);

    const qrSpy = vi.spyOn(whatsappBrokerClient, 'getQrCode').mockResolvedValue({
      qr: 'data:image/png;base64,DEFAULT_QR',
      qrCode: 'data:image/png;base64,DEFAULT_QR',
      qrExpiresAt: null,
      expiresAt: '2024-01-04T00:00:00.000Z',
    });

    try {
      const response = await fetch(`${url}/api/integrations/whatsapp/instances/qr.png`, {
        method: 'GET',
        headers: {
          'x-tenant-id': 'tenant-123',
        },
      });

      const arrayBuffer = await response.arrayBuffer();

      expect(qrSpy).toHaveBeenCalledWith('leadengine', { instanceId: 'leadengine' });
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('image/png');
      expect(Buffer.from(arrayBuffer)).toEqual(Buffer.from('DEFAULT_QR', 'base64'));
    } finally {
      await stopTestServer(server);
    }
  });

  it('retrieves WhatsApp instance status', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const { whatsappBrokerClient } = await import('../services/whatsapp-broker-client');
    const { prisma } = await import('../lib/prisma');

    let storedInstance = {
      id: 'instance-6',
      tenantId: 'tenant-123',
      name: 'Instance 6',
      brokerId: 'instance-6',
      phoneNumber: '+5511900000000',
      status: 'connected',
      connected: true,
      lastSeenAt: null,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
      metadata: { history: [] },
    } as Awaited<ReturnType<typeof prisma.whatsAppInstance.findFirst>>;

    prisma.whatsAppInstance.findFirst.mockResolvedValue(storedInstance);
    prisma.whatsAppInstance.findMany.mockImplementation(async () => [storedInstance]);
    prisma.whatsAppInstance.update.mockImplementation(async ({ data, where }) => {
      if (where.id === storedInstance.id) {
        storedInstance = {
          ...storedInstance,
          ...data,
          metadata: data.metadata ?? storedInstance.metadata,
        } as typeof storedInstance;
      }

      return storedInstance as Awaited<ReturnType<typeof prisma.whatsAppInstance.update>>;
    });

    const listSpy = vi.spyOn(whatsappBrokerClient, 'listInstances').mockResolvedValue([
      {
        instance: {
          id: 'instance-6',
          tenantId: 'tenant-123',
          name: 'Instance 6',
          status: 'qr_required',
          connected: false,
          phoneNumber: '+5511900000000',
        },
        status: {
          status: 'qr_required',
          connected: false,
          qr: 'data:image/png;base64,QR',
          qrCode: 'data:image/png;base64,QR',
          qrExpiresAt: '2024-01-05T00:00:00.000Z',
          expiresAt: '2024-01-05T00:00:00.000Z',
          stats: null,
          metrics: null,
          messages: null,
          rate: null,
          rateUsage: null,
          raw: null,
        },
      },
    ]);

    try {
      const response = await fetch(
        `${url}/api/integrations/whatsapp/instances/instance-6/status`,
        {
          method: 'GET',
          headers: {
            'x-tenant-id': 'tenant-123',
          },
        }
      );

      const body = await response.json();

      expect(listSpy).toHaveBeenCalledWith('tenant-123');
      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        success: true,
        data: {
          connected: false,
          status: expect.objectContaining({ status: 'qr_required', connected: false }),
          qr: {
            qr: 'data:image/png;base64,QR',
            qrCode: 'data:image/png;base64,QR',
            qrExpiresAt: '2024-01-05T00:00:00.000Z',
            expiresAt: '2024-01-05T00:00:00.000Z',
          },
          instance: expect.objectContaining({ id: 'instance-6', status: 'qr_required' }),
          instances: expect.arrayContaining([
            expect.objectContaining({ id: 'instance-6', status: 'qr_required' }),
          ]),
        },
      });
    } finally {
      await stopTestServer(server);
    }
  });

  it('normalizes broker metrics in status payloads for the dashboard cards', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const { whatsappBrokerClient } = await import('../services/whatsapp-broker-client');
    const { prisma } = await import('../lib/prisma');

    let storedInstance = {
      id: 'instance-metrics',
      tenantId: 'tenant-123',
      name: 'Instance Metrics',
      brokerId: 'instance-metrics',
      phoneNumber: '+5511912345678',
      status: 'connected',
      connected: true,
      lastSeenAt: null,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
      metadata: { history: [] },
    } as Awaited<ReturnType<typeof prisma.whatsAppInstance.findFirst>>;

    prisma.whatsAppInstance.findFirst.mockResolvedValue(storedInstance);
    prisma.whatsAppInstance.findMany.mockImplementation(async () => [storedInstance]);
    prisma.whatsAppInstance.update.mockImplementation(async ({ data, where }) => {
      if (where.id === storedInstance.id) {
        storedInstance = {
          ...storedInstance,
          ...data,
          metadata: data.metadata ?? storedInstance.metadata,
        } as typeof storedInstance;
      }

      return storedInstance as Awaited<ReturnType<typeof prisma.whatsAppInstance.update>>;
    });

    const listSpy = vi.spyOn(whatsappBrokerClient, 'listInstances').mockResolvedValue([
      {
        instance: {
          id: 'instance-metrics',
          tenantId: 'tenant-123',
          name: 'Instance Metrics',
          status: 'connected',
          connected: true,
          phoneNumber: '+5511912345678',
        },
        status: {
          status: 'connected',
          connected: true,
          qr: null,
          qrCode: null,
          qrExpiresAt: null,
          expiresAt: null,
          stats: null,
          metrics: { messagesSent: '18' },
          messages: {
            pending: { total: '5' },
            failures: { total: '2' },
            statusCounts: { '1': '3', status_2: 4 },
          },
          rate: null,
          rateUsage: { used: '40', limit: '100' },
          raw: {
            metrics: { throttle: { remaining: 60, limit: 100 } },
            messages: { pending: { total: 5 } },
          },
        },
      },
    ]);

    try {
      const response = await fetch(
        `${url}/api/integrations/whatsapp/instances/${storedInstance.id}/status`,
        {
          method: 'GET',
          headers: {
            'x-tenant-id': 'tenant-123',
          },
        }
      );

      const body = await response.json();

      expect(listSpy).toHaveBeenCalledWith('tenant-123');
      expect(response.status).toBe(200);

      const instancePayload = body?.data?.instance ?? null;
      expect(instancePayload?.metrics).toMatchObject({
        messagesSent: 18,
        sent: 18,
        queued: 5,
        failed: 2,
        statusCounts: {
          '1': 3,
          '2': 4,
          '3': 0,
          '4': 0,
          '5': 0,
        },
        rateUsage: {
          used: 40,
          limit: 100,
          remaining: 60,
          percentage: 40,
        },
      });

      const listInstance = Array.isArray(body?.data?.instances)
        ? body.data.instances.find((item: { id?: string }) => item?.id === storedInstance.id)
        : null;

      expect(listInstance?.metrics).toMatchObject({
        sent: 18,
        queued: 5,
        failed: 2,
      });

      const normalizedMetadata = instancePayload?.metadata?.normalizedMetrics ?? null;
      expect(normalizedMetadata).toMatchObject({ sent: 18, queued: 5, failed: 2 });
    } finally {
      await stopTestServer(server);
    }
  });

  it('proxies contact existence checks to the broker', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const transportModule = await import('../features/whatsapp-transport');
    const transportMock = {
      mode: 'http',
      sendMessage: vi.fn(),
      checkRecipient: vi.fn().mockResolvedValue({ exists: true }),
      getGroups: vi.fn(),
      createPoll: vi.fn(),
    } as const;
    const getTransportSpy = vi
      .spyOn(transportModule, 'getWhatsAppTransport')
      .mockReturnValue(transportMock as unknown as WhatsAppTransport);
    const { prisma } = await import('../lib/prisma');

    const instance = {
      id: 'inst-exists',
      tenantId: 'tenant-123',
      brokerId: 'broker-123',
    } as Awaited<ReturnType<typeof prisma.whatsAppInstance.findFirst>>;
    prisma.whatsAppInstance.findFirst.mockResolvedValue(instance);

    try {
      const response = await fetch(
        `${url}/api/integrations/whatsapp/instances/${instance.id}/exists`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-tenant-id': 'tenant-123',
          },
          body: JSON.stringify({ to: '+5511988887777' }),
        }
      );

      const body = await response.json();

      expect(transportMock.checkRecipient).toHaveBeenCalledWith({
        sessionId: 'broker-123',
        instanceId: 'inst-exists',
        to: '+5511988887777',
      });
      expect(response.status).toBe(200);
      expect(body).toEqual({ success: true, data: { exists: true } });
    } finally {
      getTransportSpy.mockRestore();
      await stopTestServer(server);
    }
  });

  it('proxies group listing to the broker', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const transportModule = await import('../features/whatsapp-transport');
    const transportMock = {
      mode: 'http',
      sendMessage: vi.fn(),
      checkRecipient: vi.fn(),
      getGroups: vi.fn().mockResolvedValue({ groups: [{ id: 'grp-1', subject: 'Equipe' }] }),
      createPoll: vi.fn(),
    } as const;
    const getTransportSpy = vi
      .spyOn(transportModule, 'getWhatsAppTransport')
      .mockReturnValue(transportMock as unknown as WhatsAppTransport);
    const { prisma } = await import('../lib/prisma');

    const instance = {
      id: 'inst-groups',
      tenantId: 'tenant-123',
      brokerId: 'broker-groups',
    } as Awaited<ReturnType<typeof prisma.whatsAppInstance.findFirst>>;
    prisma.whatsAppInstance.findFirst.mockResolvedValue(instance);

    try {
      const response = await fetch(
        `${url}/api/integrations/whatsapp/instances/${instance.id}/groups`,
        {
          method: 'GET',
          headers: {
            'x-tenant-id': 'tenant-123',
          },
        }
      );

      const body = await response.json();

      expect(transportMock.getGroups).toHaveBeenCalledWith({
        sessionId: 'broker-groups',
        instanceId: 'inst-groups',
      });
      expect(response.status).toBe(200);
      expect(body).toEqual({ success: true, data: { groups: [{ id: 'grp-1', subject: 'Equipe' }] } });
    } finally {
      getTransportSpy.mockRestore();
      await stopTestServer(server);
    }
  });

  it('proxies metrics retrieval to the broker', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const brokerModule = await import('../services/whatsapp-broker-client');
    const { whatsappBrokerClient } = brokerModule;
    const { prisma } = await import('../lib/prisma');

    const instance = {
      id: 'inst-metrics',
      tenantId: 'tenant-123',
      brokerId: 'broker-metrics',
    } as Awaited<ReturnType<typeof prisma.whatsAppInstance.findFirst>>;
    prisma.whatsAppInstance.findFirst.mockResolvedValue(instance);

    const metricsSpy = vi
      .spyOn(whatsappBrokerClient, 'getMetrics')
      .mockResolvedValue({ messages: { sent: 42 } });

    try {
      const response = await fetch(
        `${url}/api/integrations/whatsapp/instances/${instance.id}/metrics`,
        {
          method: 'GET',
          headers: {
            'x-tenant-id': 'tenant-123',
          },
        }
      );

      const body = await response.json();

      expect(metricsSpy).toHaveBeenCalledWith({
        sessionId: 'broker-metrics',
        instanceId: 'inst-metrics',
      });
      expect(response.status).toBe(200);
      expect(body).toEqual({ success: true, data: { messages: { sent: 42 } } });
    } finally {
      await stopTestServer(server);
    }
  });

  it('returns 410 Gone for legacy session endpoints', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });

    try {
      const connect = await fetch(`${url}/api/integrations/whatsapp/session/connect`, {
        method: 'POST',
        headers: { 'x-tenant-id': 'tenant-123' },
      });
      const connectBody = await connect.json();

      expect(connect.status).toBe(410);
      expect(connectBody).toMatchObject({ success: false, error: { code: 'ENDPOINT_GONE' } });

      const logout = await fetch(`${url}/api/integrations/whatsapp/session/logout`, {
        method: 'POST',
        headers: { 'x-tenant-id': 'tenant-123' },
      });
      const logoutBody = await logout.json();

      expect(logout.status).toBe(410);
      expect(logoutBody).toMatchObject({ success: false, error: { code: 'ENDPOINT_GONE' } });

      const status = await fetch(`${url}/api/integrations/whatsapp/session/status`, {
        method: 'GET',
        headers: { 'x-tenant-id': 'tenant-123' },
      });
      const statusBody = await status.json();

      expect(status.status).toBe(410);
      expect(statusBody).toMatchObject({ success: false, error: { code: 'ENDPOINT_GONE' } });
    } finally {
      await stopTestServer(server);
    }
  });

  it('sends messages through a specific WhatsApp instance when payload is valid', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });

    const { prisma } = await import('../lib/prisma');

    (prisma.whatsAppInstance.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'inst-1',
      tenantId: 'tenant-123',
      status: 'connected',
      connected: true,
    });

    sendAdHocMock.mockResolvedValue({ success: true, data: { id: 'wamid-321' } });

    try {
      const response = await fetch(`${url}/api/integrations/whatsapp/instances/inst-1/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-tenant-id': 'tenant-123',
          'Idempotency-Key': 'itest-001',
        },
        body: JSON.stringify({
          to: '5511999999999',
          payload: { type: 'text', text: 'Olá instancia' },
          idempotencyKey: 'itest-001',
        }),
      });

      const body = await response.json();

      expect(response.status).toBe(202);
      expect(sendAdHocMock).toHaveBeenCalledTimes(1);
      const adHocArgs = sendAdHocMock.mock.calls[0]?.[0];
      expect(adHocArgs).toMatchObject({
        operatorId: 'user-1',
        instanceId: 'inst-1',
        to: '5511999999999',
        payload: expect.objectContaining({ type: 'text', content: 'Olá instancia' }),
        rateLimitConsumed: true,
        tenantId: 'tenant-123',
      });
      expect(body).toEqual({ success: true, data: { id: 'wamid-321' } });
    } finally {
      await stopTestServer(server);
    }
  });

  it('rejects invalid payloads on the instance message endpoint with validation details', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const { prisma } = await import('../lib/prisma');

    (prisma.whatsAppInstance.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'inst-1',
      tenantId: 'tenant-123',
      status: 'connected',
      connected: true,
    });

    try {
      const response = await fetch(`${url}/api/integrations/whatsapp/instances/inst-1/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-tenant-id': 'tenant-123',
        },
        body: JSON.stringify({}),
      });

      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error?.code).toBe('VALIDATION_ERROR');
      expect(body.error?.details?.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'to' }),
          expect.objectContaining({ field: 'payload' }),
        ])
      );
      expect(sendAdHocMock).not.toHaveBeenCalled();
    } finally {
      await stopTestServer(server);
    }
  });

  it('returns ack payload when creating WhatsApp polls', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const transportModule = await import('../features/whatsapp-transport');
    const transportMock = {
      mode: 'http',
      sendMessage: vi.fn(),
      checkRecipient: vi.fn(),
      getGroups: vi.fn(),
      createPoll: vi.fn().mockResolvedValue({
        id: 'poll-123',
        status: 'PENDING',
        ack: 0,
        rate: { limit: 5, remaining: 4, resetAt: '2024-05-06T12:00:00.000Z' },
        raw: { selectableCount: 1 },
      }),
    } as const;
    const getTransportSpy = vi
      .spyOn(transportModule, 'getWhatsAppTransport')
      .mockReturnValue(transportMock as unknown as WhatsAppTransport);
    const { prisma } = await import('../lib/prisma');

    (prisma.whatsAppInstance.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'inst-poll-1',
      tenantId: 'tenant-123',
      status: 'connected',
      connected: true,
    });

    try {
      const response = await fetch(
        `${url}/api/integrations/whatsapp/instances/inst-poll-1/polls`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-tenant-id': 'tenant-123',
          },
          body: JSON.stringify({
            to: '5511999999999',
            question: 'Qual opção?',
            options: ['A', 'B'],
          }),
        }
      );

      const body = await response.json();

      expect(transportMock.createPoll).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'inst-poll-1',
          instanceId: 'inst-poll-1',
          to: '5511999999999',
        })
      );
      expect(response.status).toBe(201);
      expect(body).toMatchObject({
        success: true,
        data: {
          poll: {
            id: 'poll-123',
            status: 'PENDING',
            ack: 0,
            raw: { selectableCount: 1 },
          },
          rate: {
            limit: 5,
            remaining: 4,
            resetAt: '2024-05-06T12:00:00.000Z',
          },
        },
      });
    } finally {
      getTransportSpy.mockRestore();
      await stopTestServer(server);
    }
  });

  it('propagates Baileys poll failures via error payload', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const transportModule = await import('../features/whatsapp-transport');
    const transportMock = {
      mode: 'http',
      sendMessage: vi.fn(),
      checkRecipient: vi.fn(),
      getGroups: vi.fn(),
      createPoll: vi.fn().mockResolvedValue({
        id: 'poll-failed-1',
        status: 'FAILED',
        ack: 'failed',
        rate: null,
        raw: null,
      }),
    } as const;
    const getTransportSpy = vi
      .spyOn(transportModule, 'getWhatsAppTransport')
      .mockReturnValue(transportMock as unknown as WhatsAppTransport);
    const { prisma } = await import('../lib/prisma');

    (prisma.whatsAppInstance.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'inst-poll-2',
      tenantId: 'tenant-123',
      status: 'connected',
      connected: true,
    });

    try {
      const response = await fetch(
        `${url}/api/integrations/whatsapp/instances/inst-poll-2/polls`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-tenant-id': 'tenant-123',
          },
          body: JSON.stringify({
            to: '5511999999999',
            question: 'Erro?',
            options: ['Sim', 'Não'],
          }),
        }
      );

      const body = await response.json();

      expect(transportMock.createPoll).toHaveBeenCalledOnce();
      expect(response.status).toBe(502);
      expect(body).toMatchObject({
        success: false,
        error: {
          code: 'WHATSAPP_POLL_FAILED',
          details: { ack: 'failed', status: 'FAILED', id: 'poll-failed-1' },
        },
      });
    } finally {
      getTransportSpy.mockRestore();
      await stopTestServer(server);
    }
  });

});
