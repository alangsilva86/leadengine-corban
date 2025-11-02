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

describe('useAiSuggestions', () => {
  let useAiSuggestions;

  const createQueryClient = () =>
    new QueryClient({
      defaultOptions: {
        mutations: {
          retry: false,
        },
      },
    });

  const createWrapper = (client) => ({ children }) =>
    createElement(QueryClientProvider, { client }, children);

  beforeEach(async () => {
const originalFetch = globalThis.fetch;

const createWrapper = () => {
  const client = new QueryClient();
  return ({ children }) => createElement(QueryClientProvider, { client }, children);
};

describe('useAiSuggestions', () => {
  let fetchMock;
  let useAiSuggestions;

  beforeEach(async () => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        suggestion: {
          next_step: 'Ligue para o lead',
          tips: ['Tenha empatia'],
        },
      }),
      headers: {
        get: vi.fn().mockReturnValue(null),
      },
    });

    globalThis.fetch = fetchMock;

    ({ useAiSuggestions } = await import('../useAiSuggestions.js'));
  });

  afterEach(() => {
    apiPostMock.mockReset();
  });

  it('cria escopo por ticket evitando vazamento de dados entre conversas', async () => {
    const queryClient = createQueryClient();
    const wrapper = createWrapper(queryClient);

    apiPostMock.mockResolvedValueOnce({
      suggestion: { next_step: 'Seguimento inicial' },
    });

    const { result, rerender } = renderHook(
      (props) => useAiSuggestions(props),
      {
        initialProps: { ticketId: 'ticket-1', tenantId: 'tenant-1' },
        wrapper,
      },
    );

    await act(async () => {
      await result.current.requestSuggestions({
        ticket: { id: 'ticket-1', tenantId: 'tenant-1' },
        timeline: [{ id: 'message-1' }],
      });
    });

    await waitFor(() => {
      expect(result.current.data?.nextStep).toBe('Seguimento inicial');
    });

    expect(
      queryClient
        .getMutationCache()
        .findAll({ mutationKey: ['chat', 'ai-suggestions', 'tenant-1', 'ticket-1'] })
        .length,
    ).toBe(1);

    rerender({ ticketId: 'ticket-2', tenantId: 'tenant-1' });

    await waitFor(() => {
      expect(result.current.data).toBeNull();
    });

    apiPostMock.mockResolvedValueOnce({
      suggestion: { next_step: 'Seguimento alternativo' },
    });

    await act(async () => {
      await result.current.requestSuggestions({
        ticket: { id: 'ticket-2', tenantId: 'tenant-1' },
        timeline: [{ id: 'message-2' }],
      });
    });

    await waitFor(() => {
      expect(result.current.data?.nextStep).toBe('Seguimento alternativo');
    });

    expect(
      queryClient
        .getMutationCache()
        .findAll({ mutationKey: ['chat', 'ai-suggestions', 'tenant-1', 'ticket-2'] })
        .length,
    ).toBe(1);

    queryClient.clear();
  });
});

    if (originalFetch) {
      globalThis.fetch = originalFetch;
    } else {
      delete globalThis.fetch;
    }

    vi.resetModules();
  });

  it('envia a requisição para /api/ai/suggest com os headers esperados', async () => {
    const { result } = renderHook(() => useAiSuggestions(), { wrapper: createWrapper() });

    let response;
    await act(async () => {
      response = await result.current.requestSuggestions({
        ticket: {
          id: 'ticket-123',
          contact: { id: 'contact-001', name: 'Maria' },
        },
        timeline: [],
      });
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/ai/suggest');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-tenant-id': 'demo-tenant',
    });

    const parsedBody = JSON.parse(init.body);
    expect(parsedBody.ticket.id).toBe('ticket-123');

    expect(response.nextStep).toBe('Ligue para o lead');

    await waitFor(() => {
      expect(result.current.data?.nextStep).toBe('Ligue para o lead');
    });
  });
});
