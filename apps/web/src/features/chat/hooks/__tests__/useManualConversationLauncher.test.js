/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiPostMock = vi.fn();

vi.mock('@/lib/api.js', () => ({
  apiPost: (...args) => apiPostMock(...args),
}));

const invalidateQueriesMock = vi.fn();

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: invalidateQueriesMock,
    }),
  };
});

let useManualConversationLauncher;

beforeEach(async () => {
  ({ useManualConversationLauncher } = await import('../useManualConversationLauncher.js'));
});

describe('useManualConversationLauncher', () => {
  const createWrapper = () => {
    const client = new QueryClient();
    return ({ children }) => createElement(QueryClientProvider, { client }, children);
  };

  afterEach(() => {
    apiPostMock.mockReset();
    invalidateQueriesMock.mockReset();
  });

  it('envia o payload formatado e retorna o ticket criado', async () => {
    apiPostMock.mockResolvedValue({
      data: {
        ticket: { id: 'ticket-123' },
        ticketId: 'ticket-123',
        message: { id: 'message-abc', ticketId: 'ticket-123' },
      },
    });

    const { result } = renderHook(() => useManualConversationLauncher(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.launch({
        phone: '(11) 98888-7766',
        message: '  Olá ',
        instanceId: 'instance-001',
      });
    });

    expect(apiPostMock).toHaveBeenCalledWith('/api/tickets/messages', {
      chatId: '11988887766',
      iid: 'instance-001',
      text: 'Olá',
      metadata: {
        origin: 'manual-conversation',
        phone: '11988887766',
      },
    });

    await waitFor(() => {
      expect(result.current.data?.ticketId).toBe('ticket-123');
    });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ['chat', 'messages', 'ticket-123'],
    });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ['chat', 'tickets'] });
  });

  it('falha ao enviar quando faltam dados obrigatórios', async () => {
    const { result } = renderHook(() => useManualConversationLauncher(), {
      wrapper: createWrapper(),
    });

    await expect(
      result.current.launch({ phone: '', message: 'hi', instanceId: 'abc' })
    ).rejects.toThrow('Informe um telefone válido com DDD e país.');

    await expect(
      result.current.launch({ phone: '(11) 90000-0000', message: '   ', instanceId: 'abc' })
    ).rejects.toThrow('Digite a mensagem inicial.');

    await expect(
      result.current.launch({ phone: '(11) 90000-0000', message: 'olá', instanceId: '' })
    ).rejects.toThrow('Selecione uma instância conectada.');
  });
});
