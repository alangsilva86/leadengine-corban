import express from 'express';
import request from 'supertest';
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import type { RequestHandler, Router } from 'express';
import { LeadStatus, LeadSource } from '@prisma/client';

const leadFindMany = vi.fn();
const leadCount = vi.fn();
const leadCreate = vi.fn();
const contactFindUnique = vi.fn();

vi.mock('../lib/prisma', () => ({
  prisma: {
    lead: {
      findMany: leadFindMany,
      count: leadCount,
      create: leadCreate,
    },
    contact: {
      findUnique: contactFindUnique,
    },
  },
}));

let leadsRouter: Router;
let errorHandler: RequestHandler;

beforeAll(async () => {
  ({ leadsRouter } = await import('./leads'));
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
  app.use('/', leadsRouter);
  app.use(errorHandler as unknown as RequestHandler);
  return app;
};

describe('Leads routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns paginated leads list', async () => {
    const now = new Date();
    leadFindMany.mockResolvedValueOnce([
      {
        id: 'lead-1',
        tenantId: 'tenant-1',
        contactId: 'contact-1',
        status: LeadStatus.NEW,
        source: LeadSource.WHATSAPP,
        createdAt: now,
        updatedAt: now,
        tags: [],
        customFields: {},
        contact: { id: 'contact-1', name: 'Maria', tenantId: 'tenant-1', createdAt: now, updatedAt: now },
        campaign: null,
        assignee: null,
      },
    ]);
    leadCount.mockResolvedValueOnce(1);

    const app = buildApp();
    const response = await request(app).get('/?page=1&limit=10');

    expect(response.status).toBe(200);
    expect(leadFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 10,
      })
    );
    expect(response.body).toMatchObject({
      success: true,
      data: {
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    });
    expect(Array.isArray(response.body.data.items)).toBe(true);
    expect(response.body.data.items[0].id).toBe('lead-1');
  });

  it('creates a new lead when contact exists', async () => {
    const now = new Date();
    contactFindUnique.mockResolvedValueOnce({
      id: 'contact-1',
      tenantId: 'tenant-1',
    });
    leadCreate.mockResolvedValueOnce({
      id: 'lead-2',
      tenantId: 'tenant-1',
      contactId: 'contact-1',
      status: LeadStatus.NEW,
      source: LeadSource.WHATSAPP,
      createdAt: now,
      updatedAt: now,
      tags: [],
      customFields: {},
      contact: { id: 'contact-1', tenantId: 'tenant-1', name: 'Maria', createdAt: now, updatedAt: now },
      campaign: null,
      assignee: null,
    });

    const app = buildApp();
    const response = await request(app)
      .post('/')
      .send({ contactId: 'contact-1', source: 'whatsapp' });

    expect(response.status).toBe(201);
    expect(contactFindUnique).toHaveBeenCalledWith({ where: { id: 'contact-1' } });
    expect(leadCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          contactId: 'contact-1',
          source: LeadSource.WHATSAPP,
        }),
      })
    );
    expect(response.body.data.id).toBe('lead-2');
  });

  it('returns not found when contact does not exist', async () => {
    contactFindUnique.mockResolvedValueOnce(null);

    const app = buildApp();
    const response = await request(app)
      .post('/')
      .send({ contactId: 'missing-contact', source: 'WHATSAPP' });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});
