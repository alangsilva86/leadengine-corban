import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const tx = {
    lead: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    leadActivity: { create: vi.fn() },
    ticket: { findMany: vi.fn(), updateMany: vi.fn() },
  };
  return {
    tx,
    prisma: { $transaction: vi.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)) },
    findTicketById: vi.fn(),
    emitTicketRealtimeEnvelope: vi.fn(),
    emitToTenant: vi.fn(),
  };
});

vi.mock('../../../lib/prisma', () => ({ prisma: mocks.prisma }));
vi.mock('@ticketz/storage', () => ({ findTicketById: mocks.findTicketById }));
vi.mock('../../../lib/socket-registry', () => ({ emitToTenant: mocks.emitToTenant }));
vi.mock('../../tickets/shared/realtime', () => ({
  buildTicketRealtimeEnvelope: ({ ticket }: { ticket: { id: string; stage: string } }) => ({
    ticketId: ticket.id,
    ticketStage: ticket.stage,
  }),
  emitTicketRealtimeEnvelope: mocks.emitTicketRealtimeEnvelope,
}));

import {
  InvalidLeadStageTransitionError,
  LeadStageConflictError,
  setLeadStage,
} from '../lead-stage-service';
import { NotFoundError } from '@ticketz/core';

const baseLead = {
  id: 'lead-1',
  tenantId: 'tenant-1',
  contactId: 'contact-1',
  stage: 'qualificacao',
  status: 'QUALIFIED',
  actualCloseDate: null,
  lostReason: null,
  updatedAt: new Date('2027-01-01T00:00:00Z'),
};

describe('setLeadStage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tx.lead.findFirst.mockResolvedValue({ ...baseLead });
    mocks.tx.lead.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.lead.findUniqueOrThrow.mockImplementation(async () => ({
      ...baseLead,
      ...mocks.tx.lead.updateMany.mock.calls.at(-1)?.[0]?.data,
    }));
    mocks.tx.leadActivity.create.mockImplementation(async ({ data }) => ({ id: 'activity-1', ...data }));
    mocks.tx.ticket.findMany.mockResolvedValue([{ id: 'ticket-1' }, { id: 'ticket-2' }]);
    mocks.tx.ticket.updateMany.mockResolvedValue({ count: 2 });
    mocks.findTicketById.mockImplementation(async (_tenantId: string, id: string) => ({ id, stage: 'proposta' }));
  });

  it('updates the lead, mirrors LeadStatus, records the activity and syncs open tickets', async () => {
    const result = await setLeadStage({
      tenantId: 'tenant-1',
      leadId: 'lead-1',
      stage: 'proposta',
      actorId: 'user-1',
      reason: '  Simulação enviada  ',
      source: 'crm',
    });

    expect(mocks.tx.lead.findFirst).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', contact: { tenantId: 'tenant-1' }, id: 'lead-1' },
    });
    expect(mocks.tx.lead.updateMany).toHaveBeenCalledWith({
      where: { id: 'lead-1', tenantId: 'tenant-1', stage: 'qualificacao' },
      data: { stage: 'proposta', status: 'PROPOSAL' },
    });
    expect(mocks.tx.leadActivity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        leadId: 'lead-1',
        userId: 'user-1',
        type: 'STATUS_CHANGED',
        title: 'Etapa alterada: Qualificação → Proposta',
        description: 'Simulação enviada',
        metadata: expect.objectContaining({
          from: 'qualificacao',
          to: 'proposta',
          reason: 'Simulação enviada',
          source: 'crm',
          previousStatus: 'QUALIFIED',
          status: 'PROPOSAL',
        }),
      }),
    });
    expect(mocks.tx.ticket.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        contactId: 'contact-1',
        status: { in: ['OPEN', 'PENDING', 'ASSIGNED'] },
        stage: { not: 'proposta' },
      },
      select: { id: true },
    });
    expect(mocks.tx.ticket.updateMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', id: { in: ['ticket-1', 'ticket-2'] } },
      data: { stage: 'proposta' },
    });
    expect(result).toMatchObject({
      previousStage: 'qualificacao',
      stage: 'proposta',
      changed: true,
      syncedTicketIds: ['ticket-1', 'ticket-2'],
    });
    expect(mocks.emitTicketRealtimeEnvelope).toHaveBeenCalledTimes(2);
    expect(mocks.emitTicketRealtimeEnvelope.mock.calls.map((call) => call[1].id)).toEqual(['ticket-1', 'ticket-2']);
    expect(mocks.emitToTenant).toHaveBeenCalledWith(
      'tenant-1',
      'leads.updated',
      expect.objectContaining({ leadId: 'lead-1', stage: 'proposta', previousStage: 'qualificacao', source: 'crm' })
    );
  });

  it('closes the lead on ganho/perdido and stores the lost reason', async () => {
    await setLeadStage({ tenantId: 'tenant-1', leadId: 'lead-1', stage: 'perdido', reason: 'Sem margem', source: 'inbox' });

    const { data } = mocks.tx.lead.updateMany.mock.calls[0][0];
    expect(data).toMatchObject({ stage: 'perdido', status: 'LOST', lostReason: 'Sem margem' });
    expect(data.actualCloseDate).toBeInstanceOf(Date);

    mocks.tx.lead.updateMany.mockClear();
    await setLeadStage({ tenantId: 'tenant-1', leadId: 'lead-1', stage: 'ganho', source: 'crm' });
    expect(mocks.tx.lead.updateMany.mock.calls[0][0].data).toMatchObject({ stage: 'ganho', status: 'CONVERTED' });
  });

  it('reopens a lost lead through reciclar and clears the close date', async () => {
    mocks.tx.lead.findFirst.mockResolvedValue({ ...baseLead, stage: 'perdido', status: 'LOST' });

    await setLeadStage({ tenantId: 'tenant-1', contactId: 'contact-1', stage: 'reciclar', source: 'inbox' });

    expect(mocks.tx.lead.findFirst).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', contact: { tenantId: 'tenant-1' }, contactId: 'contact-1' },
    });
    expect(mocks.tx.lead.updateMany.mock.calls[0][0].data).toEqual({
      stage: 'reciclar',
      status: 'NURTURING',
      actualCloseDate: null,
    });
  });

  it.each([
    ['ganho', 'proposta'],
    ['ganho', 'reciclar'],
    ['perdido', 'contato'],
  ] as const)('rejects %s → %s without writing anything', async (from, to) => {
    mocks.tx.lead.findFirst.mockResolvedValue({ ...baseLead, stage: from });

    const error = await setLeadStage({ tenantId: 'tenant-1', leadId: 'lead-1', stage: to, source: 'crm' }).catch(
      (caught: unknown) => caught
    );

    expect(error).toBeInstanceOf(InvalidLeadStageTransitionError);
    expect(error).toMatchObject({ from, to });
    expect(mocks.tx.lead.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.ticket.updateMany).not.toHaveBeenCalled();
    expect(mocks.emitTicketRealtimeEnvelope).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when the lead does not exist in the tenant', async () => {
    mocks.tx.lead.findFirst.mockResolvedValue(null);

    await expect(
      setLeadStage({ tenantId: 'tenant-1', leadId: 'missing', stage: 'proposta', source: 'crm' })
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('detects a concurrent stage change', async () => {
    mocks.tx.lead.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      setLeadStage({ tenantId: 'tenant-1', leadId: 'lead-1', stage: 'proposta', source: 'crm' })
    ).rejects.toBeInstanceOf(LeadStageConflictError);
    expect(mocks.tx.leadActivity.create).not.toHaveBeenCalled();
  });

  it('is a no-op for the lead when the stage is unchanged but still aligns diverging tickets', async () => {
    mocks.tx.ticket.findMany.mockResolvedValue([{ id: 'ticket-9' }]);

    const result = await setLeadStage({ tenantId: 'tenant-1', leadId: 'lead-1', stage: 'qualificacao', source: 'inbox' });

    expect(result.changed).toBe(false);
    expect(result.activity).toBeNull();
    expect(mocks.tx.lead.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.leadActivity.create).not.toHaveBeenCalled();
    expect(mocks.tx.ticket.updateMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', id: { in: ['ticket-9'] } },
      data: { stage: 'qualificacao' },
    });
    expect(mocks.emitToTenant).not.toHaveBeenCalled();
  });

  it('requires a lead or contact id', async () => {
    await expect(setLeadStage({ tenantId: 'tenant-1', stage: 'novo', source: 'crm' })).rejects.toThrow(
      /Informe o lead ou o contato/
    );
  });
});
