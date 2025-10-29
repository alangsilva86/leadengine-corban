import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import useTicketFieldUpdaters from '../useTicketFieldUpdaters.ts';

const toastMock = {
  error: vi.fn(),
  success: vi.fn(),
};

vi.mock('sonner', () => ({
  toast: toastMock,
}));

const updateContactMutateAsync = vi.fn();
const updateNextStepMutateAsync = vi.fn();
const updateDealMutateAsync = vi.fn();

vi.mock(new URL('../api/useUpdateContactField.js', import.meta.url).pathname, () => ({
  __esModule: true,
  default: () => ({ mutateAsync: updateContactMutateAsync }),
}));

vi.mock(new URL('../api/useUpdateNextStep.js', import.meta.url).pathname, () => ({
  __esModule: true,
  default: () => ({ mutateAsync: updateNextStepMutateAsync }),
}));

vi.mock(new URL('../api/useUpdateDealFields.js', import.meta.url).pathname, () => ({
  __esModule: true,
  default: () => ({ mutateAsync: updateDealMutateAsync }),
}));

describe('useTicketFieldUpdaters', () => {
  beforeEach(() => {
    updateContactMutateAsync.mockReset();
    updateNextStepMutateAsync.mockReset();
    updateDealMutateAsync.mockReset();
    toastMock.error.mockReset();
    toastMock.success.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes contact fields before triggering mutation', async () => {
    updateContactMutateAsync.mockResolvedValue({});

    const { result } = renderHook(() =>
      useTicketFieldUpdaters({
        controller: { selectedTicketId: 'ticket-1' },
        selectedTicket: { id: 'ticket-1' } as any,
        selectedContact: { id: 'contact-1', phone: '11999999999' } as any,
        selectedLead: null,
        currentUser: null,
      })
    );

    await act(async () => {
      await result.current.onContactFieldSave('phone', '(11) 9999-9999');
    });

    expect(updateContactMutateAsync).toHaveBeenCalledWith({
      targetContactId: 'contact-1',
      data: { phone: '11999999999' },
    });
  });

  it('updates next step and notifies success', async () => {
    updateNextStepMutateAsync.mockResolvedValue({});

    const { result } = renderHook(() =>
      useTicketFieldUpdaters({
        controller: { selectedTicketId: 'ticket-1' },
        selectedTicket: {
          id: 'ticket-1',
          metadata: { nextAction: { description: 'Anterior' } },
        } as any,
        selectedContact: { id: 'contact-1' } as any,
        selectedLead: null,
        currentUser: { id: 'agent-1' },
      })
    );

    await act(async () => {
      await result.current.onNextStepSave(' Novo passo ');
    });

    expect(updateNextStepMutateAsync).toHaveBeenCalledWith({
      targetTicketId: 'ticket-1',
      description: 'Novo passo',
      metadata: expect.objectContaining({ updatedBy: 'agent-1' }),
    });
    expect(toastMock.success).toHaveBeenCalledWith('Próximo passo atualizado.');
  });

  it('normalizes deal fields before calling API', async () => {
    updateDealMutateAsync.mockResolvedValue({});

    const { result } = renderHook(() =>
      useTicketFieldUpdaters({
        controller: { selectedTicketId: 'ticket-1' },
        selectedTicket: { id: 'ticket-1' } as any,
        selectedContact: { id: 'contact-1' } as any,
        selectedLead: {
          id: 'lead-1',
          customFields: { deal: { netValue: 100 } },
        } as any,
        currentUser: null,
      })
    );

    await act(async () => {
      await result.current.onDealFieldSave('netValue', '1.234,56');
    });

    expect(updateDealMutateAsync).toHaveBeenCalledWith({
      targetLeadId: 'lead-1',
      data: { netValue: 1234.56 },
    });
  });
});
