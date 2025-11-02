/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
