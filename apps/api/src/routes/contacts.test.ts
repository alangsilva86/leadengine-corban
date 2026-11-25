import express from 'express';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import type { RequestHandler, Router } from 'express';

// d6052f69: o router de contatos delega a persistência ao @ticketz/storage (listContacts/createContact),
// então o teste isola o router nessa fronteira em vez de mockar o Prisma da API.
const { listContactsMock, createContactMock, updateContactMock } = vi.hoisted(() => ({
  listContactsMock: vi.fn(),
  createContactMock: vi.fn(),
  updateContactMock: vi.fn(),
}));

vi.mock('@ticketz/storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ticketz/storage')>();
  return {
    ...actual,
    listContacts: listContactsMock,
    createContact: createContactMock,
    updateContact: updateContactMock,
  };
});

const buildPage = <T,>(items: T[], page: number, limit: number, total: number) => ({
  items,
  total,
  page,
  limit,
  totalPages: Math.ceil(total / limit),
  hasNext: page * limit < total,
  hasPrev: page > 1,
});

const buildUniqueViolation = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target: ['tenantId', 'primaryEmail'] },
  });

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
    const now = new Date().toISOString();
    listContactsMock.mockResolvedValueOnce(
      buildPage(
        [
          {
            id: 'contact-1',
            tenantId: 'tenant-1',
            name: 'Maria',
            phone: '+5562999887766',
            email: 'maria@example.com',
            tags: ['lead'],
            createdAt: now,
            updatedAt: now,
          },
        ],
        1,
        10,
        1
      )
    );

    const app = buildApp();
    const response = await request(app).get('/?page=1&limit=10&search=maria');

    expect(response.status).toBe(200);
    expect(listContactsMock).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ page: 1, limit: 10 }),
      { search: 'maria' }
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

  it('defaults pagination params when not provided', async () => {
    listContactsMock.mockResolvedValueOnce(buildPage([], 1, 20, 0));

    const app = buildApp();
    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    expect(listContactsMock).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ page: 1, limit: 20, sortOrder: 'desc' }),
      undefined
    );
    expect(response.body.data.limit).toBe(20);
    expect(response.body.data.page).toBe(1);
  });

  it('creates a new contact scoped to the authenticated tenant', async () => {
    createContactMock.mockResolvedValueOnce({
      id: 'contact-2',
      tenantId: 'tenant-1',
      name: 'Carlos',
      phone: '+5562999776655',
      email: 'carlos@example.com',
      tags: ['lead'],
    });

    const app = buildApp();
    const response = await request(app)
      .post('/')
      .send({
        tenantId: 'other-tenant',
        name: 'Carlos',
        phone: '+5562999776655',
        email: 'carlos@example.com',
        tags: ['lead'],
      });

    expect(response.status).toBe(201);
    expect(createContactMock).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      payload: expect.objectContaining({ name: 'Carlos', email: 'carlos@example.com' }),
    });
    expect(response.body.data.id).toBe('contact-2');
  });

  it('maps Prisma unique constraint errors to conflict error on create', async () => {
    createContactMock.mockRejectedValueOnce(buildUniqueViolation());

    const app = buildApp();
    const response = await request(app)
      .post('/')
      .send({ name: 'Maria', email: 'duplicate@example.com' });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONFLICT');
  });

  it('maps Prisma unique constraint errors to conflict error on update', async () => {
    updateContactMock.mockRejectedValueOnce(buildUniqueViolation());

    const app = buildApp();
    const response = await request(app)
      .patch('/6f1c2b9e-7f4a-4d3b-9a51-2f0d4b8c1e11')
      .send({ email: 'duplicate@example.com' });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONFLICT');
  });
});
