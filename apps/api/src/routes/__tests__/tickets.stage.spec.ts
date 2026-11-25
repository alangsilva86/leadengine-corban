import express, { type Request } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listTickets: vi.fn(),
  createTicket: vi.fn(),
  updateTicket: vi.fn(),
}));

vi.mock('../../middleware/auth', () => ({
  requireTenant: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock('../../services/ticket-service', () => ({
  ticketService: {
    queries: { listTickets: mocks.listTickets, getTicketById: vi.fn() },
    lifecycle: {
      createTicket: mocks.createTicket,
      updateTicket: mocks.updateTicket,
      assignTicket: vi.fn(),
      closeTicket: vi.fn(),
    },
  },
}));

import { ticketsBaseRouter } from '../tickets.base';
import { errorHandler } from '../../middleware/error-handler';
import { InvalidLeadStageTransitionError } from '../../services/leads/lead-stage-service';

const TICKET_ID = '11111111-1111-4111-8111-111111111111';
const CONTACT_ID = '22222222-2222-4222-8222-222222222222';
const QUEUE_ID = '33333333-3333-4333-8333-333333333333';

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as Request).user = {
      id: 'user-1',
      tenantId: 'tenant-1',
      email: 'agent@example.com',
      name: 'Agent',
      role: 'AGENT',
      isActive: true,
      permissions: [],
    } as Request['user'];
    next();
  });
  app.use('/api/tickets', ticketsBaseRouter);
  app.use(errorHandler);
  return app;
};

describe('tickets routes — etapa do funil único', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocks.updateTicket.mockImplementation(async (_tenantId, id, input) => ({ id, stage: input.stage ?? 'novo' }));
    mocks.createTicket.mockImplementation(async (input) => ({ id: TICKET_ID, ...input }));
    mocks.listTickets.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20, totalPages: 0, hasNext: false, hasPrev: false });
  });

  it.each([
    ['proposta', 'proposta'],
    ['aguardando_cliente', 'documentacao'],
    ['documentos_averbacao', 'averbacao'],
    ['aprovado_liquidacao', 'ganho'],
    ['CONVERTED', 'ganho'],
  ])('PUT normalizes stage %s to %s and passes the actor for the lead sync', async (input, stage) => {
    const response = await request(buildApp()).put(`/api/tickets/${TICKET_ID}`).send({ stage: input });

    expect(response.status).toBe(200);
    expect(response.body.data.stage).toBe(stage);
    expect(mocks.updateTicket).toHaveBeenCalledWith(
      'tenant-1',
      TICKET_ID,
      expect.objectContaining({ stage }),
      { actorId: 'user-1' }
    );
  });

  it('PUT rejects unknown stages with 400', async () => {
    const response = await request(buildApp()).put(`/api/tickets/${TICKET_ID}`).send({ stage: 'constructor' });

    expect(response.status).toBe(400);
    expect(mocks.updateTicket).not.toHaveBeenCalled();
  });

  it('PUT answers 409 INVALID_STAGE_TRANSITION when the lead cannot move', async () => {
    mocks.updateTicket.mockRejectedValue(new InvalidLeadStageTransitionError('perdido', 'proposta'));

    const response = await request(buildApp()).put(`/api/tickets/${TICKET_ID}`).send({ stage: 'proposta' });

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: 'INVALID_STAGE_TRANSITION', details: { from: 'perdido', to: 'proposta' } },
    });
  });

  it('POST normalizes a legacy stage', async () => {
    const response = await request(buildApp())
      .post('/api/tickets')
      .send({ contactId: CONTACT_ID, queueId: QUEUE_ID, channel: 'WHATSAPP', stage: 'conectado' });

    expect(response.status).toBe(201);
    expect(mocks.createTicket).toHaveBeenCalledWith(expect.objectContaining({ stage: 'contato' }));
  });

  it('GET normalizes the stage filter and drops unknown values', async () => {
    const response = await request(buildApp()).get('/api/tickets?stage=conectado,proposta,contato,bogus');

    expect(response.status).toBe(200);
    expect(mocks.listTickets.mock.calls[0][1].stage).toEqual(['contato', 'proposta']);
  });
});
