import express, { type Request } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    lead: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
  },
  setLeadStage: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({ prisma: mocks.prisma }));
vi.mock('../../middleware/auth', () => ({
  requireTenant: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock('../../services/leads/lead-stage-service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/leads/lead-stage-service')>()),
  setLeadStage: mocks.setLeadStage,
}));

import { crmRouter } from '../crm';
import { errorHandler } from '../../middleware/error-handler';
import { InvalidLeadStageTransitionError } from '../../services/leads/lead-stage-service';

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
  app.use('/api/crm', crmRouter);
  app.use(errorHandler);
  return app;
};

const leadRecord = (overrides: Record<string, unknown> = {}) => ({
  id: 'lead-1',
  stage: 'proposta',
  status: 'PROPOSAL',
  value: 4500,
  source: 'WHATSAPP',
  updatedAt: new Date('2027-01-02T10:00:00Z'),
  contact: { id: 'contact-1', fullName: 'Carlos Henrique' },
  assignee: { id: 'user-1', name: 'Agent' },
  ...overrides,
});

const flatten = (value: unknown): string => JSON.stringify(value);

describe('CRM routes — funil único do lead', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  describe('PATCH /api/crm/leads/:leadId/stage', () => {
    it('changes the stage through setLeadStage and returns the CRM lead item', async () => {
      mocks.prisma.lead.findFirst.mockResolvedValueOnce({ id: 'lead-1' }).mockResolvedValueOnce(leadRecord());
      mocks.setLeadStage.mockResolvedValue({ changed: true });

      const response = await request(buildApp())
        .patch('/api/crm/leads/lead-1/stage')
        .send({ stage: 'proposta', reason: 'Simulação enviada' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: {
          id: 'lead-1',
          name: 'Carlos Henrique',
          contactId: 'contact-1',
          stage: 'proposta',
          ownerId: 'user-1',
          ownerName: 'Agent',
          lastActivityAt: '2027-01-02T10:00:00.000Z',
          source: 'whatsapp',
          channel: 'whatsapp',
          potentialValue: 4500,
          status: 'in_progress',
        },
      });
      expect(mocks.setLeadStage).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        leadId: 'lead-1',
        stage: 'proposta',
        actorId: 'user-1',
        reason: 'Simulação enviada',
        source: 'crm',
      });
      // A busca do lead é restrita ao tenant (mesmo escopo das demais rotas do CRM).
      expect(flatten(mocks.prisma.lead.findFirst.mock.calls[0][0])).toContain('"tenantId":"tenant-1"');
    });

    it.each([[{ stage: 'PREPARATION' }], [{ stage: 'etapa-x' }], [{}], [{ stage: 'proposta', reason: 'x'.repeat(501) }]])(
      'rejects an invalid payload %j with 400',
      async (body) => {
        const response = await request(buildApp()).patch('/api/crm/leads/lead-1/stage').send(body);

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({ success: false, error: { code: 'VALIDATION_ERROR' } });
        expect(mocks.setLeadStage).not.toHaveBeenCalled();
      }
    );

    it('returns 404 for a lead outside the tenant', async () => {
      mocks.prisma.lead.findFirst.mockResolvedValue(null);

      const response = await request(buildApp()).patch('/api/crm/leads/other-tenant-lead/stage').send({ stage: 'ganho' });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ success: false, error: { code: 'NOT_FOUND', message: 'Lead não encontrado.' } });
      expect(mocks.setLeadStage).not.toHaveBeenCalled();
    });

    it('returns 409 INVALID_STAGE_TRANSITION when the transition is not allowed', async () => {
      mocks.prisma.lead.findFirst.mockResolvedValue({ id: 'lead-1' });
      mocks.setLeadStage.mockRejectedValue(new InvalidLeadStageTransitionError('ganho', 'proposta'));

      const response = await request(buildApp()).patch('/api/crm/leads/lead-1/stage').send({ stage: 'proposta' });

      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'INVALID_STAGE_TRANSITION',
          message: 'Este lead já foi ganho e não pode ir para "Proposta".',
          details: { from: 'ganho', to: 'proposta' },
        },
      });
    });
  });

  describe('stage reads', () => {
    it('filters /leads by LeadStage ids (and legacy Kanban ids) and exposes lead.stage', async () => {
      mocks.prisma.lead.findMany.mockResolvedValue([leadRecord({ stage: 'averbacao', status: 'NEGOTIATION' })]);
      mocks.prisma.lead.count.mockResolvedValue(1);
      const filters = encodeURIComponent(JSON.stringify({ stages: ['averbacao', 'closed-won', 'desconhecido-x'] }));

      const response = await request(buildApp()).get(`/api/crm/leads?filters=${filters}`);

      expect(response.status).toBe(200);
      expect(response.body.data.items[0]).toMatchObject({ id: 'lead-1', stage: 'averbacao' });
      const where = flatten(mocks.prisma.lead.findMany.mock.calls[0][0].where);
      expect(where).toContain('"stage":{"in":["averbacao","ganho"]}');
      expect(where).not.toContain('"status"');
    });

    it('counts open leads as stage not in (ganho, perdido)', async () => {
      mocks.prisma.lead.count.mockResolvedValue(0);

      const response = await request(buildApp()).get('/api/crm/metrics');

      expect(response.status).toBe(200);
      expect(flatten(mocks.prisma.lead.count.mock.calls[0][0])).toContain('"stage":{"notIn":["ganho","perdido"]}');
    });

    it('groups aging buckets by lead.stage with funnel labels', async () => {
      mocks.prisma.lead.groupBy.mockResolvedValue([
        { stage: 'proposta', _count: { _all: 2 } },
        { stage: 'novo', _count: { _all: 1 } },
      ]);

      const response = await request(buildApp()).get('/api/crm/aging');

      expect(response.status).toBe(200);
      expect(mocks.prisma.lead.groupBy.mock.calls[0][0].by).toEqual(['stage']);
      const buckets = response.body.data.buckets as Array<{ stageId: string; stageName: string; bucketId: string; leadCount: number }>;
      expect(buckets).toHaveLength(10 * 5);
      expect(new Set(buckets.map((bucket) => bucket.stageId))).toEqual(
        new Set(['novo', 'contato', 'qualificacao', 'proposta', 'documentacao', 'averbacao', 'liquidacao', 'ganho', 'perdido', 'reciclar'])
      );
      expect(buckets.find((bucket) => bucket.stageId === 'proposta' && bucket.bucketId === '0-1')).toMatchObject({
        stageName: 'Proposta',
        leadCount: 2,
      });
    });
  });
});
