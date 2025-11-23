import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictError } from '@ticketz/core';

const listContactsMock = vi.fn();
const createContactMock = vi.fn();
const getContactByIdMock = vi.fn();
const updateContactMock = vi.fn();
const listContactTagsMock = vi.fn();
const applyBulkContactsActionMock = vi.fn();
const findContactsByIdsMock = vi.fn();
const listContactInteractionsMock = vi.fn();
const logContactInteractionMock = vi.fn();
const listContactTasksMock = vi.fn();
const createContactTaskMock = vi.fn();
const updateContactTaskMock = vi.fn();
const mergeContactsMock = vi.fn();

const sendWhatsappBulkActionMock = vi.fn();
const setPrismaClientMock = vi.fn();

let isStoragePrismaLinked = true;

const setStoragePrismaLinked = (value: boolean) => {
  isStoragePrismaLinked = value;
};

const resetStoragePrismaLink = () => {
  setStoragePrismaLinked(false);
};

const ensureStoragePrismaLinked = () => {
  if (isStoragePrismaLinked) {
    return;
  }

  const error = new Error('Storage Prisma client is not configured.') as Error & {
    code?: string;
  };
  error.code = 'STORAGE_PRISMA_NOT_CONFIGURED';
  throw error;
};

const withStorageGuard = <T extends (...args: unknown[]) => unknown>(mock: T): T => {
  return ((...args: Parameters<T>) => {
    ensureStoragePrismaLinked();
    return mock(...args);
  }) as T;
};

vi.mock('@ticketz/storage', () => ({
  setPrismaClient: vi.fn((client: unknown) => {
    setStoragePrismaLinked(Boolean(client));
    setPrismaClientMock(client);
  }),
  listContacts: withStorageGuard(listContactsMock),
  createContact: withStorageGuard(createContactMock),
  getContactById: withStorageGuard(getContactByIdMock),
  updateContact: withStorageGuard(updateContactMock),
  listContactTags: withStorageGuard(listContactTagsMock),
  applyBulkContactsAction: withStorageGuard(applyBulkContactsActionMock),
  findContactsByIds: withStorageGuard(findContactsByIdsMock),
  listContactInteractions: withStorageGuard(listContactInteractionsMock),
  logContactInteraction: withStorageGuard(logContactInteractionMock),
  listContactTasks: withStorageGuard(listContactTasksMock),
  createContactTask: withStorageGuard(createContactTaskMock),
  updateContactTask: withStorageGuard(updateContactTaskMock),
  mergeContacts: withStorageGuard(mergeContactsMock),
}));

vi.mock('../../services/contacts/whatsapp-bulk', () => ({
  sendWhatsappBulkAction: (...args: unknown[]) => sendWhatsappBulkActionMock(...args),
}));

let contactsRouter: express.Router;
let contactTasksRouter: express.Router;
let errorHandler: RequestHandler;

beforeAll(async () => {
  ({ contactsRouter } = await import('../contacts'));
  ({ contactTasksRouter } = await import('../contact-tasks'));
  ({ errorHandler } = await import('../../middleware/error-handler'));
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

const buildContactsApp = () => {
  const app = express();
  app.use(express.json());
  app.use(withTenant);
  app.use('/', contactsRouter);
  app.use(errorHandler as unknown as RequestHandler);
  return app;
};

const buildTasksApp = () => {
  const app = express();
  app.use(express.json());
  app.use(withTenant);
  app.use('/', contactTasksRouter);
  app.use(errorHandler as unknown as RequestHandler);
  return app;
};

describe('Contacts routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setStoragePrismaLinked(true);
    setPrismaClientMock.mockClear();
    listContactsMock.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
    });
    createContactMock.mockResolvedValue({ id: 'contact-1' });
    getContactByIdMock.mockResolvedValue(null);
    updateContactMock.mockResolvedValue(null);
    listContactTagsMock.mockResolvedValue([]);
    applyBulkContactsActionMock.mockResolvedValue([]);
    findContactsByIdsMock.mockResolvedValue([]);
    listContactInteractionsMock.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
    });
    logContactInteractionMock.mockResolvedValue({ id: 'interaction-1' });
    listContactTasksMock.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
    });
    createContactTaskMock.mockResolvedValue({ id: 'task-1' });
    updateContactTaskMock.mockResolvedValue({ id: 'task-1', status: 'PENDING' });
    mergeContactsMock.mockResolvedValue({ id: 'contact-1' });
    sendWhatsappBulkActionMock.mockResolvedValue([]);
  });

  it('lists contacts with tenant filters applied', async () => {
    const app = buildContactsApp();
    await request(app).get('/?page=2&limit=5&status=ACTIVE&tags=vip').expect(200);

    expect(listContactsMock).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ page: 2, limit: 5 }),
      expect.objectContaining({ status: ['ACTIVE'], tags: ['vip'] })
    );
  });

  it('parses boolean filters for blocked and whatsapp flags', async () => {
    const app = buildContactsApp();
    await request(app).get('/?page=1&limit=25&isBlocked=true&hasWhatsapp=true').expect(200);

    expect(listContactsMock).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ page: 1, limit: 25 }),
      expect.objectContaining({ isBlocked: true, hasWhatsapp: true })
    );
  });

  it('lists contact tags for the tenant', async () => {
    const app = buildContactsApp();
    listContactTagsMock.mockResolvedValueOnce(['vip', 'partner']);

    const response = await request(app).get('/tags').expect(200);

    expect(listContactTagsMock).toHaveBeenCalledWith('tenant-1');
    expect(response.body).toEqual({ success: true, data: ['vip', 'partner'] });
  });

  it('returns 404 when contact is not found', async () => {
    const app = buildContactsApp();
    getContactByIdMock.mockResolvedValueOnce(null);

    const response = await request(app).get('/11111111-1111-1111-1111-111111111111');
    expect(response.status).toBe(404);
  });

  it('returns the contact data when it exists', async () => {
    const app = buildContactsApp();
    const contactId = '11111111-1111-1111-1111-111111111111';
    getContactByIdMock.mockResolvedValueOnce({ id: contactId, name: 'Test' });

    const response = await request(app).get(`/${contactId}`).expect(200);

    expect(getContactByIdMock).toHaveBeenCalledWith('tenant-1', contactId);
    expect(response.body).toEqual({ success: true, data: { id: contactId, name: 'Test' } });
  });

  it('sends whatsapp action for each contact', async () => {
    const app = buildContactsApp();

    sendWhatsappBulkActionMock.mockResolvedValueOnce([
      { contactId: '22222222-2222-2222-2222-222222222222', status: 'ENQUEUED' },
    ]);

    const response = await request(app)
      .post('/actions/whatsapp')
      .send({
        contactIds: ['22222222-2222-2222-2222-222222222222'],
        message: { type: 'text', text: 'Hello' },
      });

    expect(response.status).toBe(202);
    expect(sendWhatsappBulkActionMock).toHaveBeenCalledWith({
      operatorId: 'user-1',
      payload: { contactIds: ['22222222-2222-2222-2222-222222222222'], message: { type: 'text', text: 'Hello' } },
      tenantId: 'tenant-1',
    });
    expect(response.body).toEqual({
      success: true,
      data: { results: [{ contactId: '22222222-2222-2222-2222-222222222222', status: 'ENQUEUED' }] },
    });
  });

  it('returns validation error when whatsapp payload missing message', async () => {
    const app = buildContactsApp();
    sendWhatsappBulkActionMock.mockRejectedValueOnce(new ConflictError('Whatsapp action requires a message payload.'));

    const response = await request(app)
      .post('/actions/whatsapp')
      .send({ contactIds: ['22222222-2222-2222-2222-222222222222'] });

    expect(response.status).toBe(409);
  });

  it('returns 404 when updating nonexistent task', async () => {
    const app = buildTasksApp();
    updateContactTaskMock.mockResolvedValueOnce(null);

    const response = await request(app)
      .patch('/tasks/33333333-3333-3333-3333-333333333333')
      .send({ status: 'COMPLETED' });
    expect(response.status).toBe(404);
  });
});

describe('Contacts routes bootstrap', () => {
  it('links Prisma to storage before handling requests', async () => {
    vi.resetModules();
    resetStoragePrismaLink();
    setPrismaClientMock.mockClear();

    const { prisma } = await import('../../lib/prisma');
    expect(setPrismaClientMock).toHaveBeenCalledWith(prisma);

    const contactsModule = await import('../contacts');
    const errorHandlerModule = await import('../../middleware/error-handler');

    const app = express();
    app.use(express.json());
    app.use(withTenant);
    app.use('/', contactsModule.contactsRouter);
    app.use(errorHandlerModule.errorHandler as unknown as RequestHandler);

    listContactsMock.mockResolvedValueOnce({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
    });

    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(setPrismaClientMock).toHaveBeenCalled();
  });
});
