import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const toastMock = vi.hoisted(() => ({
  error: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: toastMock,
}));

describe('useWhatsAppAvailability', () => {
  let useWhatsAppAvailability: typeof import('../useWhatsAppAvailability').default;

  beforeAll(async () => {
    ({ default: useWhatsAppAvailability } = await import('../useWhatsAppAvailability'));
  });

  beforeEach(() => {
    toastMock.error.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('stores broker unavailability and surfaces toast', () => {
    const { result } = renderHook(() => useWhatsAppAvailability({ selectedTicketId: 'ticket-1' }));

    act(() => {
      result.current.notifyOutboundError({ code: 'BROKER_NOT_CONFIGURED' } as any, 'fallback');
    });

    expect(toastMock.error).toHaveBeenCalledWith('WhatsApp não configurado', {
      description: 'Conecte uma instância do WhatsApp para habilitar novos envios.',
    });
    expect(result.current.unavailableReason).toMatchObject({
      code: 'BROKER_NOT_CONFIGURED',
      title: 'WhatsApp não configurado',
      description: 'Conecte uma instância do WhatsApp para habilitar novos envios.',
    });
    expect(result.current.composerDisabled).toBe(true);
  });

  it('resets availability state on demand', () => {
    const { result } = renderHook(() => useWhatsAppAvailability({ selectedTicketId: 'ticket-1' }));

    act(() => {
      result.current.notifyOutboundError({ code: 'UNKNOWN' } as any, 'fallback');
    });

    act(() => {
      result.current.resetAvailability();
    });

    expect(result.current.unavailableReason).toBeNull();
    expect(result.current.composerDisabled).toBe(false);
  });

  it('clears unavailability when ticket changes', () => {
    const { result, rerender } = renderHook(
      ({ ticketId }: { ticketId: string }) => useWhatsAppAvailability({ selectedTicketId: ticketId }),
      { initialProps: { ticketId: 'ticket-1' } }
    );

    act(() => {
      result.current.notifyOutboundError({ code: 'BROKER_NOT_CONFIGURED' } as any, 'fallback');
    });

    rerender({ ticketId: 'ticket-2' });

    expect(result.current.unavailableReason).toBeNull();
    expect(result.current.composerDisabled).toBe(false);
  });

  it('prefers recovery hints when building availability notice', () => {
    const { result } = renderHook(() => useWhatsAppAvailability({ selectedTicketId: 'ticket-1' }));

    act(() => {
      result.current.notifyOutboundError(
        {
          payload: {
            error: {
              recoveryHint: 'Reconecte o broker antes de tentar novamente.',
              requestId: 'req-123',
            },
          },
        } as any,
        'fallback copy'
      );
    });

    expect(result.current.notice?.description).toBe('Reconecte o broker antes de tentar novamente. (ID: req-123)');
    expect(toastMock.error).toHaveBeenLastCalledWith(expect.anything(), {
      description: 'Reconecte o broker antes de tentar novamente. (ID: req-123)',
    });
  });
});
