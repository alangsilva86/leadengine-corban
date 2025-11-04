/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { sanitizeAiTimeline } from '../../utils/aiTimeline.js';

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
    vi.resetModules();
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

  it('sanitiza a linha do tempo mantendo o payload enviado anteriormente', async () => {
    const wrapper = createWrapper(createQueryClient());
    const timeline = [
      ...Array.from({ length: 55 }, (_, index) => ({
        id: `entry-${index + 1}`,
        type: 'message',
        timestamp: `2024-01-${String(index + 1).padStart(2, '0')}T12:00:00.000Z`,
        payload: {
          id: `payload-${index + 1}`,
          content: `Mensagem ${index + 1}`,
          direction: index % 2 === 0 ? 'inbound' : 'outbound',
          author: 'Cliente',
          timestamp: `2024-01-${String(index + 1).padStart(2, '0')}T12:00:00.000Z`,
          metadata: { direction: 'inbound', channel: 'whatsapp' },
        },
      })),
    ];

    apiPostMock.mockResolvedValue({ suggestion: { next_step: 'Checar follow-up' } });

    const { result } = renderHook(() => useAiSuggestions({ ticketId: 'ticket-1' }), { wrapper });

    await act(async () => {
      await result.current.requestSuggestions({
        ticket: { id: 'ticket-1' },
        timeline,
      });
    });

    expect(apiPostMock).toHaveBeenCalledTimes(1);
    const [url, payload] = apiPostMock.mock.calls[0];
    expect(url).toBe('/api/ai/suggest');
    expect(payload.timeline).toEqual(sanitizeAiTimeline(timeline));
    expect(payload.ticket.id).toBe('ticket-1');
    expect(payload?.text?.format?.name).toBe('AiSuggestion');
  });
});
