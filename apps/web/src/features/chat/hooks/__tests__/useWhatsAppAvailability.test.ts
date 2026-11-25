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
      description: 'Conecte um número de WhatsApp para enviar mensagens.',
    });
    expect(result.current.unavailableReason).toMatchObject({
      code: 'BROKER_NOT_CONFIGURED',
      title: 'WhatsApp não configurado',
      description: 'Conecte um número de WhatsApp para enviar mensagens.',
    });
    expect(result.current.composerDisabled).toBe(true);
  });

  // Formato devolvido por POST /api/tickets/:id/messages (apps/api/src/routes/messages/send-errors.ts) e
  // transformado em erro por lib/api.js (`error.payload` = corpo da resposta).
  const buildSendFailure = (code: string, brokerCode: string, status: number) => ({
    message: 'mensagem do servidor',
    status,
    payload: {
      success: false,
      error: {
        code,
        message: 'mensagem do servidor',
        requestId: 'rid-1',
        details: { brokerCode, brokerStatus: status, requestId: 'broker-req' },
      },
    },
  });

  it.each([
    ['BROKER_TIMEOUT', 'REQUEST_TIMEOUT', 408, 'Tempo limite excedido', 'Reconectar ao WhatsApp'],
    ['INSTANCE_NOT_CONNECTED', 'SESSION_NOT_CONNECTED', 409, 'Número desconectado', 'Reconectar ao WhatsApp'],
    ['RATE_LIMITED', 'RATE_LIMIT_EXCEEDED', 429, 'Limite de envio atingido', null],
    ['INVALID_TO', 'INVALID_RECIPIENT', 400, 'Número de destino inválido', null],
  ])('shows the %s copy for normalized send failures', (code, brokerCode, status, title, actionLabel) => {
    const { result } = renderHook(() => useWhatsAppAvailability({ selectedTicketId: 'ticket-1' }));

    act(() => {
      result.current.notifyOutboundError(buildSendFailure(code, brokerCode, status) as any, 'fallback');
    });

    expect(toastMock.error).toHaveBeenCalledWith(title, { description: expect.stringContaining('(ID: rid-1)') });
    expect(result.current.notice).toMatchObject({ code, title, actionLabel });
    expect(result.current.composerDisabled).toBe(false);
  });

  it('disables the composer for BROKER_NOT_CONFIGURED send failures', () => {
    const { result } = renderHook(() => useWhatsAppAvailability({ selectedTicketId: 'ticket-1' }));

    act(() => {
      result.current.notifyOutboundError(buildSendFailure('BROKER_NOT_CONFIGURED', 'BROKER_NOT_CONFIGURED', 503) as any, 'fallback');
    });

    expect(result.current.notice).toMatchObject({ title: 'WhatsApp não configurado' });
    expect(result.current.composerDisabled).toBe(true);
  });

  it('falls back to generic copy without reconnect for raw broker codes (why the API normalizes them)', () => {
    const { result } = renderHook(() => useWhatsAppAvailability({ selectedTicketId: 'ticket-1' }));

    act(() => {
      result.current.notifyOutboundError(buildSendFailure('REQUEST_TIMEOUT', 'REQUEST_TIMEOUT', 408) as any, 'fallback');
    });

    expect(result.current.notice).toMatchObject({ title: 'Mensagem não enviada', actionLabel: null });
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
