import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findTicketById: vi.fn(),
  updateTicket: vi.fn(),
  leadFindFirst: vi.fn(),
  setLeadStage: vi.fn(),
  emitTicketRealtimeEnvelope: vi.fn(),
}));

vi.mock('@ticketz/storage', () => ({
  assignTicket: vi.fn(),
  closeTicket: vi.fn(),
  createTicket: vi.fn(),
  findTicketById: mocks.findTicketById,
  findTicketsByContact: vi.fn(),
  updateTicket: mocks.updateTicket,
}));
vi.mock('../../../lib/prisma', () => ({ prisma: { lead: { findFirst: mocks.leadFindFirst } } }));
vi.mock('../../leads/lead-stage-service', () => ({ setLeadStage: mocks.setLeadStage }));
vi.mock('../shared/realtime', () => ({
  buildTicketRealtimeEnvelope: vi.fn(() => ({})),
  emitTicketEvent: vi.fn(),
  emitTicketRealtimeEnvelope: mocks.emitTicketRealtimeEnvelope,
}));

import { updateTicket } from '../mutations/lifecycle';

const ticket = { id: 'ticket-1', tenantId: 'tenant-1', contactId: 'contact-1', status: 'OPEN', stage: 'novo', metadata: {} };

describe('lifecycle.updateTicket — etapa do lead', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findTicketById.mockResolvedValue(ticket);
    mocks.updateTicket.mockImplementation(async (_tenantId, _id, input) => ({ ...ticket, ...input }));
    mocks.setLeadStage.mockResolvedValue({ changed: true, syncedTicketIds: ['ticket-1'] });
  });

  it('routes the stage change through setLeadStage when the contact has a lead', async () => {
    mocks.leadFindFirst.mockResolvedValue({ id: 'lead-1' });

    const updated = await updateTicket('tenant-1', 'ticket-1', { stage: 'proposta', priority: 'HIGH' }, { actorId: 'user-1' });

    expect(mocks.leadFindFirst).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', contactId: 'contact-1', contact: { tenantId: 'tenant-1' } },
      select: { id: true },
    });
    expect(mocks.setLeadStage).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      leadId: 'lead-1',
      stage: 'proposta',
      actorId: 'user-1',
      source: 'inbox',
    });
    expect(mocks.setLeadStage.mock.invocationCallOrder[0]).toBeLessThan(mocks.updateTicket.mock.invocationCallOrder[0]);
    expect(mocks.updateTicket).toHaveBeenCalledWith('tenant-1', 'ticket-1', { stage: 'proposta', priority: 'HIGH' });
    expect(updated.stage).toBe('proposta');
  });

  it('only updates the ticket when the contact has no lead', async () => {
    mocks.leadFindFirst.mockResolvedValue(null);

    await updateTicket('tenant-1', 'ticket-1', { stage: 'qualificacao' });

    expect(mocks.setLeadStage).not.toHaveBeenCalled();
    expect(mocks.updateTicket).toHaveBeenCalledWith('tenant-1', 'ticket-1', { stage: 'qualificacao' });
  });

  it('does not touch the ticket when the lead transition is rejected', async () => {
    mocks.leadFindFirst.mockResolvedValue({ id: 'lead-1' });
    mocks.setLeadStage.mockRejectedValue(new Error('INVALID_STAGE_TRANSITION'));

    await expect(updateTicket('tenant-1', 'ticket-1', { stage: 'proposta' })).rejects.toThrow('INVALID_STAGE_TRANSITION');
    expect(mocks.updateTicket).not.toHaveBeenCalled();
  });

  it('skips the lead lookup when the stage is not being changed', async () => {
    await updateTicket('tenant-1', 'ticket-1', { priority: 'LOW' });

    expect(mocks.findTicketById).not.toHaveBeenCalled();
    expect(mocks.leadFindFirst).not.toHaveBeenCalled();
    expect(mocks.setLeadStage).not.toHaveBeenCalled();
  });
});
