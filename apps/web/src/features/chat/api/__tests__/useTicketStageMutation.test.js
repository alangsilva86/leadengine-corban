/** @vitest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import useTicketStageMutation from '../useTicketStageMutation.js';

const LIST_KEY = ['chat', 'tickets', { filters: {} }];

const createClient = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } });
  client.setQueryData(LIST_KEY, {
    items: [
      { id: 't1', stage: 'qualificacao', pipelineStep: 'qualificacao', contact: { name: 'Ana' } },
      { id: 't2', stage: 'novo', contact: { name: 'Bruno' } },
    ],
  });
  return client;
};

const wrapperFor = (client) => ({ children }) => createElement(QueryClientProvider, { client }, children);

const jsonResponse = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const stageOf = (client, id) => client.getQueryData(LIST_KEY).items.find((item) => item.id === id).stage;

describe('useTicketStageMutation (Inbox)', () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('muda a etapa na hora, envia PUT /api/tickets/:id { stage } e mantém após sucesso', async () => {
    let respond;
    fetchMock.mockImplementation(() => new Promise((resolve) => {
      respond = resolve;
    }));
    const client = createClient();
    const { result } = renderHook(() => useTicketStageMutation(), { wrapper: wrapperFor(client) });

    let pending;
    act(() => {
      pending = result.current.mutateAsync({ ticketId: 't1', stage: 'proposta' });
    });

    await waitFor(() => expect(stageOf(client, 't1')).toBe('proposta'));
    expect(stageOf(client, 't2')).toBe('novo');

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/tickets/t1');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual({ stage: 'proposta' });

    respond(jsonResponse(200, { success: true, data: { id: 't1', stage: 'proposta' } }));
    await act(async () => {
      await pending;
    });
    expect(stageOf(client, 't1')).toBe('proposta');
  });

  it('volta à etapa anterior quando a API recusa e expõe a mensagem do servidor', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(409, { success: false, error: { code: 'INVALID_STAGE_TRANSITION', message: 'Lead perdido só pode ir para Reciclar.' } }),
    );
    const client = createClient();
    const { result } = renderHook(() => useTicketStageMutation(), { wrapper: wrapperFor(client) });

    let caught;
    await act(async () => {
      try {
        await result.current.mutateAsync({ ticketId: 't1', stage: 'ganho' });
      } catch (error) {
        caught = error;
      }
    });

    expect(caught?.status).toBe(409);
    expect(caught?.message).toBe('Lead perdido só pode ir para Reciclar.');
    expect(stageOf(client, 't1')).toBe('qualificacao');
  });
});
