import express from 'express';
import type { Request } from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { Prisma } from '@prisma/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

const createModelMock = () => ({
  findMany: vi.fn(),
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  createMany: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  deleteMany: vi.fn(),
  upsert: vi.fn(),
});

const prismaMock = {
  whatsAppInstance: createModelMock(),
  campaign: createModelMock(),
  processedIntegrationEvent: createModelMock(),
  contact: createModelMock(),
  ticket: createModelMock(),
  user: createModelMock(),
  $transaction: vi.fn(),
  $connect: vi.fn(),
  $disconnect: vi.fn(),
} as Record<string, ReturnType<typeof createModelMock> | ReturnType<typeof vi.fn>>;

vi.mock('../lib/prisma', () => ({
  prisma: prismaMock,
}));

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

  const userModel = prismaMock.user as ReturnType<typeof createModelMock>;
  userModel.findUnique.mockResolvedValue(null);
};

resetPrismaMocks();

const originalWhatsAppEnv = {
  url: process.env.WHATSAPP_BROKER_URL,
  apiKey: process.env.WHATSAPP_BROKER_API_KEY,
  mode: process.env.WHATSAPP_MODE,
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

  if (typeof originalWhatsAppEnv.mode === 'string') {
    process.env.WHATSAPP_MODE = originalWhatsAppEnv.mode;
  } else {
    delete process.env.WHATSAPP_MODE;
  }
};

afterEach(() => {
  vi.restoreAllMocks();
  restoreWhatsAppEnv();
  resetPrismaMocks();
  emitToTenantMock.mockReset();
  sendAdHocMock.mockReset();
});

const startTestServer = async ({
  configureWhatsApp = false,
}: { configureWhatsApp?: boolean } = {}) => {
  vi.resetModules();
  if (configureWhatsApp) {
    process.env.WHATSAPP_MODE = 'http';
    process.env.WHATSAPP_BROKER_URL = 'http://broker.test';
    process.env.WHATSAPP_BROKER_API_KEY = 'test-key';
  } else {
    delete process.env.WHATSAPP_MODE;
    delete process.env.WHATSAPP_BROKER_URL;
    delete process.env.WHATSAPP_BROKER_API_KEY;
  }

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
        (prismaMock.whatsAppInstance.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
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
        (prismaMock.whatsAppInstance.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
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
        (prismaMock.whatsAppInstance.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
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
        (prismaMock.whatsAppInstance.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
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
    } as Awaited<ReturnType<typeof prisma.whatsAppInstance.findUnique>>;

    prisma.whatsAppInstance.findUnique.mockResolvedValue(storedInstance);

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
    } as Awaited<ReturnType<typeof prisma.whatsAppInstance.findUnique>>;

    prisma.whatsAppInstance.findUnique.mockResolvedValue(storedInstance);

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
              metrics: expect.objectContaining({
                messagesSent: 42,
                sent: 42,
                queued: 3,
              }),
              rate: expect.objectContaining({ limit: 100, remaining: 97 }),
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
          warnings: expect.arrayContaining([
            expect.objectContaining({ code: 'WHATSAPP_STORAGE_FALLBACK' }),
          ]),
        }),
      });
    } finally {
      await stopTestServer(server);
    }
  });

  it('creates a WhatsApp instance', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const { prisma } = await import('../lib/prisma');
    const { whatsappBrokerClient } = await import('../services/whatsapp-broker-client');

    const brokerInstance = {
      id: 'created-instance',
      tenantId: 'tenant-123',
      name: 'created-instance',
      status: 'connecting' as const,
      connected: false,
      phoneNumber: '+5511987654321',
    };

    const createInstanceSpy = vi
      .spyOn(whatsappBrokerClient, 'createInstance')
      .mockResolvedValue(brokerInstance);

    prisma.whatsAppInstance.create.mockImplementation(async ({ data }) => {
      expect(data).toMatchObject({
        id: 'created-instance',
        tenantId: 'tenant-123',
        name: 'created-instance',
        brokerId: 'created-instance',
        status: 'connecting',
        connected: false,
        phoneNumber: '+5511987654321',
        metadata: expect.objectContaining({
          displayId: 'created-instance',
          slug: 'created-instance',
          brokerId: 'created-instance',
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
        body: JSON.stringify({ name: 'created-instance' }),
      });

      const body = await response.json();

      expect(prisma.whatsAppInstance.findFirst).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-123', id: 'created-instance' },
        select: { id: true },
      });
      expect(createInstanceSpy).toHaveBeenCalledWith({
        tenantId: 'tenant-123',
        name: 'created-instance',
        instanceId: 'created-instance',
      });
      expect(prisma.whatsAppInstance.create).toHaveBeenCalledWith({
        data: {
          id: 'created-instance',
          tenantId: 'tenant-123',
          name: 'created-instance',
          brokerId: 'created-instance',
          status: 'connecting',
          connected: false,
          phoneNumber: '+5511987654321',
          metadata: expect.objectContaining({
            displayId: 'created-instance',
            slug: 'created-instance',
            brokerId: 'created-instance',
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
          id: 'created-instance',
          name: 'created-instance',
          status: 'connecting',
          connected: false,
        },
      });
    } finally {
      await stopTestServer(server);
    }
  });

  it('rejects WhatsApp instance names that contain uppercase letters or spaces', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const { prisma } = await import('../lib/prisma');

    try {
      const response = await fetch(`${url}/api/integrations/whatsapp/instances`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-tenant-id': 'tenant-123',
        },
        body: JSON.stringify({ name: 'Invalid Name' }),
      });

      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body).toMatchObject({
        success: false,
        error: { code: 'INVALID_INSTANCE_NAME' },
      });
      expect(prisma.whatsAppInstance.create).not.toHaveBeenCalled();
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

  it('creates a WhatsApp instance with a sequential identifier when the slug already exists', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const { prisma } = await import('../lib/prisma');
    const { whatsappBrokerClient } = await import('../services/whatsapp-broker-client');

    (prisma.whatsAppInstance.findFirst as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ id: 'created-instance' })
      .mockResolvedValueOnce(null);

    const createInstanceSpy = vi
      .spyOn(whatsappBrokerClient, 'createInstance')
      .mockImplementation(async ({ tenantId, name, instanceId }) => {
        expect(instanceId).toBe('created-instance-2');
        expect(name).toBe('created-instance');
        return {
          id: `${tenantId}--${instanceId}`,
          tenantId,
          name,
          status: 'connecting',
          connected: false,
        };
      });

    prisma.whatsAppInstance.create.mockImplementation(async ({ data }) => {
      expect(data).toMatchObject({
        id: 'created-instance-2',
        brokerId: 'tenant-123--created-instance-2',
        status: 'connecting',
        connected: false,
        metadata: expect.objectContaining({
          brokerId: 'tenant-123--created-instance-2',
        }),
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
        body: JSON.stringify({ name: 'created-instance' }),
      });

      const body = await response.json();

      expect(prisma.whatsAppInstance.findFirst).toHaveBeenNthCalledWith(1, {
        where: { tenantId: 'tenant-123', id: 'created-instance' },
        select: { id: true },
      });
      expect(prisma.whatsAppInstance.findFirst).toHaveBeenNthCalledWith(2, {
        where: { tenantId: 'tenant-123', id: 'created-instance-2' },
        select: { id: true },
      });
      expect(prisma.whatsAppInstance.create).toHaveBeenCalledWith({
        data: {
          id: 'created-instance-2',
          tenantId: 'tenant-123',
          name: 'created-instance',
          brokerId: 'tenant-123--created-instance-2',
          status: 'connecting',
          connected: false,
          phoneNumber: null,
          metadata: expect.objectContaining({
            displayId: 'created-instance-2',
            slug: 'created-instance',
            brokerId: 'tenant-123--created-instance-2',
            history: expect.arrayContaining([
              expect.objectContaining({ action: 'created', by: 'user-1' }),
            ]),
          }),
        },
      });
      expect(createInstanceSpy).toHaveBeenCalledWith({
        tenantId: 'tenant-123',
        name: 'created-instance',
        instanceId: 'created-instance-2',
      });
      expect(response.status).toBe(201);
      expect(body).toMatchObject({
        success: true,
        data: expect.objectContaining({ id: 'created-instance-2' }),
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
    } as Awaited<ReturnType<typeof prisma.whatsAppInstance.findUnique>>;

    prisma.whatsAppInstance.findUnique.mockResolvedValue(storedInstance);
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
          connected: true,
          status: expect.objectContaining({ status: 'connected', connected: true }),
          instance: expect.objectContaining({
            id: 'instance-3',
            status: 'connected',
            connected: true,
            phoneNumber: '+5511999999999',
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
    } as Awaited<ReturnType<typeof prisma.whatsAppInstance.findUnique>>;

    prisma.whatsAppInstance.findUnique.mockResolvedValue(storedInstance);
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
    } as Awaited<ReturnType<typeof prisma.whatsAppInstance.findUnique>>;

    prisma.whatsAppInstance.findUnique.mockResolvedValue(storedInstance);
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

      expect(prisma.whatsAppInstance.findUnique).toHaveBeenCalledWith({
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
    } as Awaited<ReturnType<typeof prisma.whatsAppInstance.findUnique>>;

    prisma.whatsAppInstance.findUnique.mockResolvedValue(storedInstance);
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
          connected: true,
          status: expect.objectContaining({ status: 'connected', connected: true }),
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
    } as Awaited<ReturnType<typeof prisma.whatsAppInstance.findUnique>>;

    prisma.whatsAppInstance.findUnique.mockResolvedValue(storedInstance);
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
    } as Awaited<ReturnType<typeof prisma.whatsAppInstance.findUnique>>;

    prisma.whatsAppInstance.findUnique.mockResolvedValue(storedInstance);
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
    } as Awaited<ReturnType<typeof prisma.whatsAppInstance.findUnique>>;

    prisma.whatsAppInstance.findUnique.mockResolvedValue(storedInstance);
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
    } as Awaited<ReturnType<typeof prisma.whatsAppInstance.findUnique>>;

    prisma.whatsAppInstance.findUnique.mockResolvedValue(storedInstance);
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
      expect(prisma.whatsAppInstance.findUnique).not.toHaveBeenCalled();
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
    } as Awaited<ReturnType<typeof prisma.whatsAppInstance.findUnique>>;

    prisma.whatsAppInstance.findUnique.mockResolvedValue(storedInstance);
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
    } as Awaited<ReturnType<typeof prisma.whatsAppInstance.findUnique>>;

    prisma.whatsAppInstance.findUnique.mockResolvedValue(storedInstance);
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

    prisma.whatsAppInstance.findUnique.mockResolvedValue({
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
    } as Awaited<ReturnType<typeof prisma.whatsAppInstance.findUnique>>);

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

    prisma.whatsAppInstance.findUnique.mockResolvedValue({
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
    } as Awaited<ReturnType<typeof prisma.whatsAppInstance.findUnique>>);

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

    prisma.whatsAppInstance.findUnique.mockResolvedValue({
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
    } as Awaited<ReturnType<typeof prisma.whatsAppInstance.findUnique>>);

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
    } as Awaited<ReturnType<typeof prisma.whatsAppInstance.findUnique>>;

    prisma.whatsAppInstance.findUnique.mockResolvedValue(storedInstance);
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
    } as Awaited<ReturnType<typeof prisma.whatsAppInstance.findUnique>>;

    prisma.whatsAppInstance.findUnique.mockResolvedValue(storedInstance);
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

  it('returns timeout errors from the WhatsApp broker with sanitized payload', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const brokerModule = await import('../services/whatsapp-broker-client');
    const { whatsappBrokerClient } = brokerModule;

    const sendSpy = vi.spyOn(whatsappBrokerClient, 'sendText').mockRejectedValue(
      new WhatsAppBrokerError('Original timeout message', 'REQUEST_TIMEOUT', 408, 'broker-timeout-1')
    );

    try {
      const response = await fetch(`${url}/api/integrations/whatsapp/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-tenant-id': 'tenant-123',
        },
        body: JSON.stringify({ to: '5511987654321', message: 'Hello from test' }),
      });

      const body = await response.json();

      expect(sendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'tenant-123',
          to: '+5511987654321',
          message: 'Hello from test',
        })
      );
      expect(response.status).toBe(408);
      expect(body).toMatchObject({
        error: {
          code: 'REQUEST_TIMEOUT',
          message: 'WhatsApp broker request timed out',
          details: { requestId: 'broker-timeout-1' },
        },
        method: 'POST',
        path: '/api/integrations/whatsapp/messages',
      });
    } finally {
      await stopTestServer(server);
    }
  });

  it('proxies contact existence checks to the broker', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const brokerModule = await import('../services/whatsapp-broker-client');
    const { whatsappBrokerClient } = brokerModule;
    const { prisma } = await import('../lib/prisma');

    const instance = {
      id: 'inst-exists',
      tenantId: 'tenant-123',
      brokerId: 'broker-123',
    } as Awaited<ReturnType<typeof prisma.whatsAppInstance.findUnique>>;
    prisma.whatsAppInstance.findUnique.mockResolvedValue(instance);

    const existsSpy = vi
      .spyOn(whatsappBrokerClient, 'checkRecipient')
      .mockResolvedValue({ exists: true });

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

      expect(existsSpy).toHaveBeenCalledWith({
        sessionId: 'broker-123',
        instanceId: 'inst-exists',
        to: '+5511988887777',
      });
      expect(response.status).toBe(200);
      expect(body).toEqual({ success: true, data: { exists: true } });
    } finally {
      await stopTestServer(server);
    }
  });

  it('proxies group listing to the broker', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const brokerModule = await import('../services/whatsapp-broker-client');
    const { whatsappBrokerClient } = brokerModule;
    const { prisma } = await import('../lib/prisma');

    const instance = {
      id: 'inst-groups',
      tenantId: 'tenant-123',
      brokerId: 'broker-groups',
    } as Awaited<ReturnType<typeof prisma.whatsAppInstance.findUnique>>;
    prisma.whatsAppInstance.findUnique.mockResolvedValue(instance);

    const groupsSpy = vi
      .spyOn(whatsappBrokerClient, 'getGroups')
      .mockResolvedValue({ groups: [{ id: 'grp-1', subject: 'Equipe' }] });

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

      expect(groupsSpy).toHaveBeenCalledWith({
        sessionId: 'broker-groups',
        instanceId: 'inst-groups',
      });
      expect(response.status).toBe(200);
      expect(body).toEqual({ success: true, data: { groups: [{ id: 'grp-1', subject: 'Equipe' }] } });
    } finally {
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
    } as Awaited<ReturnType<typeof prisma.whatsAppInstance.findUnique>>;
    prisma.whatsAppInstance.findUnique.mockResolvedValue(instance);

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

  it('returns ack metadata when WhatsApp message is dispatched', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const brokerModule = await import('../services/whatsapp-broker-client');
    const { whatsappBrokerClient } = brokerModule;

    const sendSpy = vi.spyOn(whatsappBrokerClient, 'sendText').mockResolvedValue({
      id: 'wamid-ack-1',
      status: 'SERVER_ACK',
      ack: 1,
      rate: { limit: 10, remaining: 9, resetAt: '2024-05-05T10:00:00.000Z' },
    });

    try {
      const response = await fetch(`${url}/api/integrations/whatsapp/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-tenant-id': 'tenant-123',
        },
        body: JSON.stringify({ to: '5511988888888', message: 'Ack test' }),
      });

      const body = await response.json();

      expect(sendSpy).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: 'tenant-123', to: '+5511988888888' })
      );
      expect(response.status).toBe(202);
      expect(body).toMatchObject({
        success: true,
        data: {
          id: 'wamid-ack-1',
          status: 'SERVER_ACK',
          ack: 1,
          rate: {
            limit: 10,
            remaining: 9,
            resetAt: '2024-05-05T10:00:00.000Z',
          },
        },
      });
    } finally {
      await stopTestServer(server);
    }
  });

  it('sends messages through a specific WhatsApp instance when payload is valid', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });

    const { prisma } = await import('../lib/prisma');

    (prisma.whatsAppInstance.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
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
        },
        body: JSON.stringify({
          to: '5511999999999',
          payload: { type: 'text', text: 'Olá instancia' },
        }),
      });

      const body = await response.json();

      expect(response.status).toBe(202);
      expect(sendAdHocMock).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-123',
          instanceId: 'inst-1',
          to: '5511999999999',
          payload: expect.objectContaining({ type: 'text', content: 'Olá instancia' }),
        })
      );
      expect(body).toEqual({ success: true, data: { id: 'wamid-321' } });
    } finally {
      await stopTestServer(server);
    }
  });

  it('rejects invalid payloads on the instance message endpoint with validation details', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const { prisma } = await import('../lib/prisma');

    (prisma.whatsAppInstance.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
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

  it('returns validation errors when WhatsApp message payload is empty', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const brokerModule = await import('../services/whatsapp-broker-client');
    const { whatsappBrokerClient } = brokerModule;

    const sendSpy = vi.spyOn(whatsappBrokerClient, 'sendText');

    try {
      const response = await fetch(`${url}/api/integrations/whatsapp/messages`, {
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
          expect.objectContaining({ field: 'message' }),
        ])
      );
      expect(sendSpy).not.toHaveBeenCalled();
    } finally {
      await stopTestServer(server);
    }
  });

  it('rejects WhatsApp messages with invalid phone numbers', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const brokerModule = await import('../services/whatsapp-broker-client');
    const { whatsappBrokerClient } = brokerModule;

    const sendSpy = vi.spyOn(whatsappBrokerClient, 'sendText');

    try {
      const response = await fetch(`${url}/api/integrations/whatsapp/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-tenant-id': 'tenant-123',
        },
        body: JSON.stringify({ to: '123', message: 'Mensagem' }),
      });

      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error?.code).toBe('VALIDATION_ERROR');
      expect(body.error?.details?.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'to' })])
      );
      expect(sendSpy).not.toHaveBeenCalled();
    } finally {
      await stopTestServer(server);
    }
  });

  it('maps ack failures from Baileys as message errors', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const brokerModule = await import('../services/whatsapp-broker-client');
    const { whatsappBrokerClient } = brokerModule;

    const sendSpy = vi.spyOn(whatsappBrokerClient, 'sendText').mockResolvedValue({
      id: 'wamid-fail-1',
      status: 'FAILED',
      ack: -1,
    });

    try {
      const response = await fetch(`${url}/api/integrations/whatsapp/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-tenant-id': 'tenant-123',
        },
        body: JSON.stringify({ to: '5511977777777', message: 'Should fail' }),
      });

      const body = await response.json();

      expect(sendSpy).toHaveBeenCalledOnce();
      expect(response.status).toBe(502);
      expect(body).toMatchObject({
        success: false,
        error: {
          code: 'WHATSAPP_MESSAGE_FAILED',
          details: { ack: -1, status: 'FAILED', id: 'wamid-fail-1' },
        },
      });
    } finally {
      await stopTestServer(server);
    }
  });

  it('returns ack payload when creating WhatsApp polls', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const brokerModule = await import('../services/whatsapp-broker-client');
    const { whatsappBrokerClient } = brokerModule;

    const pollSpy = vi.spyOn(whatsappBrokerClient, 'createPoll').mockResolvedValue({
      id: 'poll-123',
      status: 'PENDING',
      ack: 0,
      rate: { limit: 5, remaining: 4, resetAt: '2024-05-06T12:00:00.000Z' },
      raw: { selectableCount: 1 },
    });

    try {
      const response = await fetch(`${url}/api/integrations/whatsapp/polls`, {
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
      });

      const body = await response.json();

      expect(pollSpy).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: 'tenant-123', to: '5511999999999' })
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
      await stopTestServer(server);
    }
  });

  it('propagates Baileys poll failures via error payload', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const brokerModule = await import('../services/whatsapp-broker-client');
    const { whatsappBrokerClient } = brokerModule;

    const pollSpy = vi.spyOn(whatsappBrokerClient, 'createPoll').mockResolvedValue({
      id: 'poll-failed-1',
      status: 'FAILED',
      ack: 'failed',
    });

    try {
      const response = await fetch(`${url}/api/integrations/whatsapp/polls`, {
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
      });

      const body = await response.json();

      expect(pollSpy).toHaveBeenCalledOnce();
      expect(response.status).toBe(502);
      expect(body).toMatchObject({
        success: false,
        error: {
          code: 'WHATSAPP_POLL_FAILED',
          details: { ack: 'failed', status: 'FAILED', id: 'poll-failed-1' },
        },
      });
    } finally {
      await stopTestServer(server);
    }
  });

  it('returns broker 4xx errors with sanitized message and code', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const brokerModule = await import('../services/whatsapp-broker-client');
    const { whatsappBrokerClient } = brokerModule;

    const sendSpy = vi.spyOn(whatsappBrokerClient, 'sendText').mockRejectedValue(
      new WhatsAppBrokerError('Rate limit reached', 'RATE_LIMIT_EXCEEDED', 429, 'broker-rate-2')
    );

    try {
      const response = await fetch(`${url}/api/integrations/whatsapp/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-tenant-id': 'tenant-123',
        },
        body: JSON.stringify({ to: '5511987654322', message: 'Second test message' }),
      });

      const body = await response.json();

      expect(sendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'tenant-123',
          to: '+5511987654322',
          message: 'Second test message',
        })
      );
      expect(response.status).toBe(429);
      expect(body).toMatchObject({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'WhatsApp broker request rate limit exceeded',
          details: { requestId: 'broker-rate-2' },
        },
        method: 'POST',
        path: '/api/integrations/whatsapp/messages',
      });
    } finally {
      await stopTestServer(server);
    }
  });
});
