import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { NotFoundError } from '@ticketz/core';

const findUniqueMock = vi.fn();
const findFirstMock = vi.fn();
const createTicketMock = vi.fn();

vi.mock('../../../../config/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../../lib/prisma', () => ({
  prisma: {
    queue: {
      findUnique: findUniqueMock,
      findFirst: findFirstMock,
    },
  },
}));

vi.mock('../../../../services/ticket-service', () => ({
  createTicket: createTicketMock,
  sendMessage: vi.fn(),
}));

type TestingHelpers = typeof import('../inbound-lead-service')['__testing'];

let testing!: TestingHelpers;

beforeAll(async () => {
  testing = (await import('../inbound-lead-service')).__testing;
});

describe('getDefaultQueueId', () => {
  beforeEach(() => {
    testing.queueCacheByTenant.clear();
    vi.resetAllMocks();
  });

  it('returns cached queue id when entry is valid and queue exists', async () => {
    testing.queueCacheByTenant.set('tenant-1', {
      id: 'queue-1',
      expires: Date.now() + testing.DEFAULT_QUEUE_CACHE_TTL_MS,
    });

    findUniqueMock.mockResolvedValueOnce({ id: 'queue-1' });

    const queueId = await testing.getDefaultQueueId('tenant-1');

    expect(queueId).toBe('queue-1');
    expect(findUniqueMock).toHaveBeenCalledTimes(1);
    expect(findFirstMock).not.toHaveBeenCalled();
  });

  it('refetches queue when cached id is missing', async () => {
    testing.queueCacheByTenant.set('tenant-2', {
      id: 'queue-old',
      expires: Date.now() + testing.DEFAULT_QUEUE_CACHE_TTL_MS,
    });

    findUniqueMock.mockResolvedValueOnce(null);
    findFirstMock.mockResolvedValueOnce({ id: 'queue-new' });

    const queueId = await testing.getDefaultQueueId('tenant-2');

    expect(queueId).toBe('queue-new');
    expect(findUniqueMock).toHaveBeenCalledWith({ where: { id: 'queue-old' } });
    expect(findFirstMock).toHaveBeenCalledTimes(1);
    expect(testing.queueCacheByTenant.get('tenant-2')).toMatchObject({ id: 'queue-new' });
  });
});

describe('ensureTicketForContact', () => {
  beforeEach(() => {
    testing.queueCacheByTenant.clear();
    vi.resetAllMocks();
  });

  it('clears cache and retries with refreshed queue when NotFoundError is thrown', async () => {
    testing.queueCacheByTenant.set('tenant-3', {
      id: 'queue-stale',
      expires: Date.now() + testing.DEFAULT_QUEUE_CACHE_TTL_MS,
    });

    createTicketMock.mockRejectedValueOnce(new NotFoundError('Queue', 'queue-stale'));
    findFirstMock.mockResolvedValueOnce({ id: 'queue-fresh' });
    createTicketMock.mockResolvedValueOnce({ id: 'ticket-123' });

    const result = await testing.ensureTicketForContact('tenant-3', 'contact-1', 'queue-stale', 'Subject', {});

    expect(result).toBe('ticket-123');
    expect(testing.queueCacheByTenant.get('tenant-3')).toMatchObject({ id: 'queue-fresh' });
    expect(createTicketMock).toHaveBeenCalledTimes(2);
    expect(createTicketMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ queueId: 'queue-fresh' })
    );
  });

  it('retries when foreign key error is present in error cause', async () => {
    testing.queueCacheByTenant.set('tenant-4', {
      id: 'queue-deleted',
      expires: Date.now() + testing.DEFAULT_QUEUE_CACHE_TTL_MS,
    });

    const prismaError = new Prisma.PrismaClientKnownRequestError('Missing queue', {
      code: 'P2003',
      clientVersion: '5.0.0',
    });
    const wrappedError = new Error('Failed to create ticket');
    (wrappedError as { cause?: unknown }).cause = prismaError;

    createTicketMock.mockRejectedValueOnce(wrappedError);
    findFirstMock.mockResolvedValueOnce({ id: 'queue-recreated' });
    createTicketMock.mockResolvedValueOnce({ id: 'ticket-456' });

    const result = await testing.ensureTicketForContact('tenant-4', 'contact-9', 'queue-deleted', 'Subject', {});

    expect(result).toBe('ticket-456');
    expect(testing.queueCacheByTenant.get('tenant-4')).toMatchObject({ id: 'queue-recreated' });
    expect(createTicketMock).toHaveBeenCalledTimes(2);
    expect(createTicketMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ queueId: 'queue-recreated' })
    );
  });
});
