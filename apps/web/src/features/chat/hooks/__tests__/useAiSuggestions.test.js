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

