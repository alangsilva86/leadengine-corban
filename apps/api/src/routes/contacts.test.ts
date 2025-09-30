import express from 'express';
import request from 'supertest';
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import type { RequestHandler, Router } from 'express';

const contactFindMany = vi.fn();
const contactCount = vi.fn();
const contactCreate = vi.fn();

vi.mock('../lib/prisma', () => ({
  prisma: {
    contact: {
      findMany: contactFindMany,
      count: contactCount,
      create: contactCreate,
    },
  },
}));

let contactsRouter: Router;
let errorHandler: RequestHandler;

beforeAll(async () => {
  ({ contactsRouter } = await import('./contacts'));
  ({ errorHandler } = await import('../middleware/error-handler'));
});

const withTenant: RequestHandler = (req, _res, next) => {
  (req as express.Request & { user?: unknown }).user = {
    id: 'user-1',
    tenantId: 'tenant-1',
    email: 'user@example.com',
    name: 'User',
    role: 'ADMIN',
    isActive: true,
    permissions: [],
  };
  next();
};

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use(withTenant);
  app.use('/', contactsRouter);
  app.use(errorHandler as unknown as RequestHandler);
  return app;
};

describe('Contacts routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns paginated contacts list with metadata', async () => {
    const now = new Date();
    contactFindMany.mockResolvedValueOnce([
      {
        id: 'contact-1',
        tenantId: 'tenant-1',
        name: 'Maria',
        phone: '+5562999887766',
        email: 'maria@example.com',
        document: '12345678900',
        tags: ['lead'],
        customFields: {},
        createdAt: now,
        updatedAt: now,
      },
    ]);
    contactCount.mockResolvedValueOnce(1);

    const app = buildApp();
    const response = await request(app).get('/?page=1&limit=10&search=maria');

    expect(response.status).toBe(200);
    expect(contactFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 10,
      })
    );
    expect(response.body).toMatchObject({
      success: true,
      data: {
        total: 1,
        totalPages: 1,
        page: 1,
        limit: 10,
        hasNext: false,
        hasPrev: false,
      },
    });
    expect(response.body.data.items[0].name).toBe('Maria');
  });

  it('creates a new contact and returns payload', async () => {
    const now = new Date();
    contactCreate.mockResolvedValueOnce({
      id: 'contact-2',
      tenantId: 'tenant-1',
      name: 'Carlos',
      phone: '+5562999776655',
      email: 'carlos@example.com',
      document: '98765432100',
      tags: ['lead'],
      customFields: {},
      createdAt: now,
      updatedAt: now,
    });

    const app = buildApp();
    const response = await request(app)
      .post('/')
      .send({
        name: 'Carlos',
        phone: '+5562999776655',
        email: 'carlos@example.com',
        tags: ['lead'],
      });

    expect(response.status).toBe(201);
    expect(contactCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          name: 'Carlos',
        }),
      })
    );
    expect(response.body.data.id).toBe('contact-2');
  });

  it('maps Prisma unique constraint errors to conflict error', async () => {
    contactCreate.mockRejectedValueOnce({
      code: 'P2002',
      meta: { target: ['tenantId', 'email'] },
    });

    const app = buildApp();
    const response = await request(app)
      .post('/')
      .send({ name: 'Maria', email: 'duplicate@example.com' });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONFLICT');
  });
});
