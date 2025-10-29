import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import useWhatsAppAvailability from '../useWhatsAppAvailability.ts';

const toastMock = {
  error: vi.fn(),
};

vi.mock('sonner', () => ({
  toast: toastMock,
}));

const resolveWhatsAppErrorCopyMock = vi.fn();

vi.mock('../../whatsapp/utils/whatsapp-error-codes.js', () => ({
  resolveWhatsAppErrorCopy: (...args: any[]) => resolveWhatsAppErrorCopyMock(...args),
}));

describe('useWhatsAppAvailability', () => {
  beforeEach(() => {
    resolveWhatsAppErrorCopyMock.mockReset();
    toastMock.error.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('stores broker unavailability and surfaces toast', () => {
    const copy = { title: 'Erro', description: 'Detalhes', code: 'BROKER_NOT_CONFIGURED' };
    resolveWhatsAppErrorCopyMock.mockReturnValue(copy);

    const { result } = renderHook(() => useWhatsAppAvailability({ selectedTicketId: 'ticket-1' }));

    act(() => {
      result.current.notifyOutboundError({ code: '123' } as any, 'fallback');
    });

    expect(toastMock.error).toHaveBeenCalledWith('Erro', { description: 'Detalhes' });
    expect(result.current.unavailableReason).toEqual(copy);
    expect(result.current.composerDisabled).toBe(true);
  });

  it('resets availability state on demand', () => {
    resolveWhatsAppErrorCopyMock.mockReturnValue({ title: 'Erro', description: 'Detalhes', code: 'OUTRO' });

    const { result } = renderHook(() => useWhatsAppAvailability({ selectedTicketId: 'ticket-1' }));

    act(() => {
      result.current.notifyOutboundError({ code: '123' } as any, 'fallback');
    });

    act(() => {
      result.current.resetAvailability();
    });

    expect(result.current.unavailableReason).toBeNull();
    expect(result.current.composerDisabled).toBe(false);
  });

  it('clears unavailability when ticket changes', () => {
    resolveWhatsAppErrorCopyMock.mockReturnValue({ title: 'Erro', description: 'Detalhes', code: 'BROKER_NOT_CONFIGURED' });

    const { result, rerender } = renderHook(
      ({ ticketId }: { ticketId: string }) => useWhatsAppAvailability({ selectedTicketId: ticketId }),
      { initialProps: { ticketId: 'ticket-1' } }
    );

    act(() => {
      result.current.notifyOutboundError({ code: '123' } as any, 'fallback');
    });

    rerender({ ticketId: 'ticket-2' });

    expect(result.current.unavailableReason).toBeNull();
    expect(result.current.composerDisabled).toBe(false);
  });
});
