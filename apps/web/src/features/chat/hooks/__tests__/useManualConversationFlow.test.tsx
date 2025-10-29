import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import useManualConversationFlow from '../useManualConversationFlow.ts';

const toastMock = {
  error: vi.fn(),
  loading: vi.fn(),
  success: vi.fn(),
};

vi.mock('sonner', () => ({
  toast: toastMock,
}));

const launchMock = vi.fn();
const refetchMock = vi.fn();
const selectTicketMock = vi.fn();

const useManualConversationLauncherMock = vi.fn();

vi.mock('../useManualConversationLauncher.js', () => ({
  useManualConversationLauncher: () => useManualConversationLauncherMock(),
}));

describe('useManualConversationFlow', () => {
  beforeEach(() => {
    launchMock.mockReset();
    launchMock.mockResolvedValue({ ticketId: 'ticket-99' });
    refetchMock.mockReset();
    refetchMock.mockResolvedValue({});
    selectTicketMock.mockReset();
    toastMock.error.mockReset();
    toastMock.loading.mockReset();
    toastMock.success.mockReset();
    useManualConversationLauncherMock.mockReturnValue({
      launch: launchMock,
      isPending: false,
      isAvailable: true,
      unavailableReason: null,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('closes dialog, triggers toast and selects ticket on success', async () => {
    const controller = {
      ticketsQuery: { refetch: refetchMock },
      selectTicket: selectTicketMock,
    };

    const { result } = renderHook(() => useManualConversationFlow({ controller }));

    act(() => result.current.setDialogOpen(true));
    expect(result.current.isDialogOpen).toBe(true);

    await act(async () => {
      await result.current.onSuccess({ ticketId: 'ticket-42' });
    });

    expect(toastMock.success).toHaveBeenCalledWith('Conversa iniciada', expect.objectContaining({
      id: 'manual-conversation',
    }));
    expect(refetchMock).toHaveBeenCalled();
    expect(selectTicketMock).toHaveBeenCalledWith('ticket-42');
    expect(result.current.isDialogOpen).toBe(false);
  });

  it('notifies error when launcher is unavailable', async () => {
    useManualConversationLauncherMock.mockReturnValue({
      launch: launchMock,
      isPending: false,
      isAvailable: false,
      unavailableReason: 'Indisponível',
    });

    const controller = {};
    const { result } = renderHook(() => useManualConversationFlow({ controller }));

    await expect(
      result.current.onSubmit({ phone: '123', message: 'Olá', instanceId: 'iid-1' })
    ).rejects.toThrow('Indisponível');

    expect(toastMock.error).toHaveBeenCalledWith('Indisponível', expect.objectContaining({
      id: 'manual-conversation',
    }));
  });

  it('propagates launcher errors with contextual toast', async () => {
    useManualConversationLauncherMock.mockReturnValue({
      launch: vi.fn(() => Promise.reject(new Error('failure'))),
      isPending: false,
      isAvailable: true,
      unavailableReason: null,
    });

    const controller = {};
    const { result } = renderHook(() => useManualConversationFlow({ controller }));

    await expect(
      result.current.onSubmit({ phone: '123', message: 'Olá', instanceId: 'iid-1' })
    ).rejects.toThrow('failure');

    expect(toastMock.error).toHaveBeenCalledWith('failure', expect.objectContaining({
      id: 'manual-conversation',
    }));
    expect(toastMock.loading).toHaveBeenCalledWith('Iniciando conversa…', expect.objectContaining({
      id: 'manual-conversation',
    }));
  });
});
