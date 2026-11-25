import express, { type Request } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const client = {
    contact: { findFirst: vi.fn() },
    lead: { findFirst: vi.fn() },
    opportunity: { create: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn() },
    opportunityActivity: { create: vi.fn() },
  };
  return {
    prisma: { ...client, $transaction: vi.fn(async (fn: (tx: typeof client) => unknown) => fn(client)) },
  };
});

vi.mock('../../lib/prisma', () => ({ prisma: mocks.prisma }));

import { opportunitiesRouter } from '../opportunities';
import { errorHandler } from '../../middleware/error-handler';

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as Request).user = { id: 'user-1', tenantId: 'tenant-1' } as Request['user'];
    next();
  });
  app.use('/api/crm/opportunities', opportunitiesRouter);
  app.use(errorHandler);
  return app;
};

const patch = (body: Record<string, unknown>) =>
  request(buildApp())
    .patch('/api/crm/opportunities/opp-1')
    .send({ version: 1, nextAction: 'Conferir documentos', reason: 'Dados revisados', ...body });

describe('opportunities — funil único do lead', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocks.prisma.opportunity.updateMany.mockResolvedValue({ count: 1 });
    mocks.prisma.opportunity.findFirst.mockImplementation(async ({ select }: { select: Record<string, unknown> }) =>
      'contact' in select ? { id: 'opp-1', stage: 'proposta', version: 2 } : { stage: 'qualificacao', version: 1 }
    );
  });

  it('creates opportunities in qualificacao', async () => {
    mocks.prisma.contact.findFirst.mockResolvedValue({ id: 'contact-1' });
    mocks.prisma.opportunity.create.mockImplementation(async ({ data }) => ({ id: 'opp-1', ...data }));

    const response = await request(buildApp())
      .post('/api/crm/opportunities')
      .set('Idempotency-Key', '6f1c2a9e-4b6d-4c8e-9a1f-3d5e7b9c1a20')
      .send({ contactId: 'contact-1', agreementRef: 'A', employmentRef: 'E', productRef: 'P', nextAction: 'Revisar' });

    expect(response.status).toBe(201);
    const { data } = mocks.prisma.opportunity.create.mock.calls[0][0];
    expect(data.stage).toBe('qualificacao');
    expect(data.activities.create).toMatchObject({ version: 1, stage: 'qualificacao' });
  });

  it.each([
    ['proposta', 'proposta'],
    ['PREPARATION', 'proposta'],
    ['FOLLOW_UP', 'averbacao'],
  ])('accepts stage %s and stores %s', async (input, stored) => {
    const response = await patch({ stage: input });

    expect(response.status).toBe(200);
    expect(mocks.prisma.opportunity.updateMany.mock.calls[0][0].data.stage).toBe(stored);
    expect(mocks.prisma.opportunityActivity.create).toHaveBeenCalledWith({
      data: { opportunityId: 'opp-1', version: 2, actorId: 'user-1', stage: stored, reason: 'Dados revisados' },
    });
  });

  it.each([
    ['ganho', 'proposta', 409],
    ['perdido', 'documentacao', 409],
    ['perdido', 'reciclar', 200],
    ['averbacao', 'qualificacao', 200],
  ])('applies canTransitionLeadStage: %s → %s = %i', async (from, to, status) => {
    mocks.prisma.opportunity.findFirst.mockImplementation(async ({ select }: { select: Record<string, unknown> }) =>
      'contact' in select ? { id: 'opp-1', stage: to, version: 2 } : { stage: from, version: 1 }
    );

    const response = await patch({ stage: to });

    expect(response.status).toBe(status);
    if (status === 409) {
      expect(mocks.prisma.opportunity.updateMany).not.toHaveBeenCalled();
    }
  });

  it('rejects an unknown stage', async () => {
    const response = await patch({ stage: 'fechado-talvez' });

    expect(response.status).toBe(400);
    expect(mocks.prisma.opportunity.updateMany).not.toHaveBeenCalled();
  });
});
