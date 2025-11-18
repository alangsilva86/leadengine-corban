/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiPostMock = vi.fn();
const apiGetMock = vi.fn();

vi.mock('@/lib/api.js', () => ({
  apiPost: (...args) => apiPostMock(...args),
  apiGet: (...args) => apiGetMock(...args),
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
    apiGetMock.mockReset();
    invalidateQueriesMock.mockReset();
  });

  it('envia o payload formatado e retorna o ticket criado', async () => {
    apiGetMock.mockResolvedValue({
      data: {
        items: [{ id: 'contact-123', phone: '+5511988887766' }],
      },
    });
    apiPostMock.mockResolvedValue({
      queued: true,
      ticketId: 'ticket-123',
      messageId: 'message-abc',
      status: 'PENDING',
      externalId: null,
      error: null,
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

    expect(apiGetMock).toHaveBeenCalledWith(expect.stringContaining('/api/contacts?'));
    expect(apiPostMock).toHaveBeenCalledWith(
      '/api/contacts/contact-123/messages',
      expect.objectContaining({
        payload: { type: 'text', text: 'Olá' },
        instanceId: 'instance-001',
        to: '+11988887766',
        idempotencyKey: expect.any(String),
      }),
      expect.objectContaining({
        headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }),
      })
    );

    await waitFor(() => {
      expect(result.current.data?.ticketId).toBe('ticket-123');
    });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ['chat', 'messages', 'ticket-123'],
    });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ['chat', 'tickets'] });
  });

  it('cria o contato quando necessário antes de enviar', async () => {
    apiGetMock.mockResolvedValue({ data: { items: [] } });
    apiPostMock
      .mockResolvedValueOnce({
        data: { id: 'contact-new', phone: '+5531988887777' },
      })
      .mockResolvedValueOnce({
        queued: true,
        ticketId: 'ticket-999',
        messageId: 'message-new',
        status: 'PENDING',
        externalId: null,
        error: null,
      });

    const { result } = renderHook(() => useManualConversationLauncher(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.launch({
        phone: '+55 (31) 98888-7777',
        message: 'Iniciando',
        instanceId: 'instance-123',
      });
    });

    expect(apiPostMock).toHaveBeenNthCalledWith(
      1,
      '/api/contacts',
      { name: '+5531988887777', phone: '+5531988887777' }
    );
    expect(apiPostMock).toHaveBeenNthCalledWith(
      2,
      '/api/contacts/contact-new/messages',
      expect.objectContaining({
        payload: { type: 'text', text: 'Iniciando' },
        instanceId: 'instance-123',
        to: '+5531988887777',
        idempotencyKey: expect.any(String),
      }),
      expect.any(Object)
    );
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

