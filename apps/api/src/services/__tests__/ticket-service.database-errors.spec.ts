import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ServiceUnavailableError, ValidationError } from '@ticketz/core';

const logger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
};

vi.mock('../../config/logger', () => ({
  logger,
}));

const emitToAgreement = vi.fn();
const emitToTenant = vi.fn();
const emitToTicket = vi.fn();
const emitToUser = vi.fn();

vi.mock('../../lib/socket-registry', () => ({
  emitToAgreement,
  emitToTenant,
  emitToTicket,
  emitToUser,
}));

const storageAssignTicket = vi.fn();

vi.mock('@ticketz/storage', () => ({
  assignTicket: storageAssignTicket,
  closeTicket: vi.fn(),
  createMessage: vi.fn(),
  createTicket: vi.fn(),
  findTicketById: vi.fn(),
  findTicketsByContact: vi.fn(),
  findMessageByExternalId: vi.fn(),
  listMessages: vi.fn(),
  listTickets: vi.fn(),
  updateMessage: vi.fn(),
  updateTicket: vi.fn(),
}));

const prisma = {
  contact: {
    findUnique: vi.fn(),
  },
  whatsAppInstance: {
    findUnique: vi.fn(),
  },
  ticket: {
    findUnique: vi.fn(),
  },
  queue: {
    findFirst: vi.fn(),
  },
};

vi.mock('../../lib/prisma', () => ({
  prisma,
}));

vi.mock('../../lib/metrics', () => ({
  whatsappOutboundMetrics: { incTotal: vi.fn(), observeLatency: vi.fn() },
  whatsappOutboundDeliverySuccessCounter: { inc: vi.fn() },
  whatsappSocketReconnectsCounter: { inc: vi.fn() },
}));

vi.mock('../../utils/circuit-breaker', () => ({
  assertCircuitClosed: vi.fn(),
  buildCircuitBreakerKey: vi.fn(() => 'circuit-key'),
  getCircuitBreakerConfig: vi.fn(() => ({ windowMs: 1000, cooldownMs: 1000 })),
  recordCircuitFailure: vi.fn(() => ({ opened: false, failureCount: 1 })),
  recordCircuitSuccess: vi.fn(() => false),
}));

const invokeErrorHandler = async (error: Error) => {
  const { errorHandler } = await import('../../middleware/error-handler');
  const status = vi.fn().mockReturnThis();
  const json = vi.fn().mockReturnThis();
  const setHeader = vi.fn();
  const res = {
    headersSent: false,
    status,
    json,
    setHeader,
    locals: {},
  } as unknown as Response;

  const req = {
    method: 'POST',
    path: '/tickets/test',
    originalUrl: '/tickets/test',
    url: '/tickets/test',
    headers: {},
    body: {},
    params: {},
    query: {},
    ip: '127.0.0.1',
    get: vi.fn(),
    rid: 'req-test',
  } as unknown as Request;

  errorHandler(error, req, res, vi.fn());

  return { status, json };
};

describe('ticket-service database error responses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('converts Prisma initialization errors into 503 responses', async () => {
    const prismaError = new Prisma.PrismaClientInitializationError('init failed', '5.22.0');
    storageAssignTicket.mockRejectedValueOnce(prismaError);

    const { assignTicket } = await import('../ticket-service');

    let caughtError: unknown;
    try {
      await assignTicket('tenant-1', 'ticket-1', 'user-1');
    } catch (error) {
      caughtError = error;
    }

    expect(storageAssignTicket).toHaveBeenCalledWith('tenant-1', 'ticket-1', 'user-1');
    expect(caughtError).toBeInstanceOf(ServiceUnavailableError);

    const { status, json } = await invokeErrorHandler(caughtError as Error);

    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'SERVICE_UNAVAILABLE',
          message: 'Falha de conectividade com o banco de dados.',
        }),
      })
    );
  });

  it('converts Prisma validation errors into 400 responses', async () => {
    const prismaError = new Prisma.PrismaClientValidationError('validation failed', {
      clientVersion: '5.22.0',
    });
    storageAssignTicket.mockRejectedValueOnce(prismaError);

    const { assignTicket } = await import('../ticket-service');

    let caughtError: unknown;
    try {
      await assignTicket('tenant-2', 'ticket-2', 'user-2');
    } catch (error) {
      caughtError = error;
    }

    expect(storageAssignTicket).toHaveBeenCalledWith('tenant-2', 'ticket-2', 'user-2');
    expect(caughtError).toBeInstanceOf(ValidationError);

    const { status, json } = await invokeErrorHandler(caughtError as Error);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos para a operação no banco de dados.',
        }),
      })
    );
  });
});
