import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';

import AiSettingsTab from '../AiSettingsTab';

const buildFetchMock = () => {
  const getResponse = {
    success: true,
    data: {
      model: 'gpt-4o-mini',
      temperature: 0.4,
      maxOutputTokens: 800,
      systemPromptReply: null,
      systemPromptSuggest: null,
      structuredOutputSchema: null,
      tools: [],
      vectorStoreEnabled: false,
      vectorStoreIds: [],
      streamingEnabled: true,
      defaultMode: 'COPILOTO',
      confidenceThreshold: 0.3,
      fallbackPolicy: null,
      aiEnabled: true,
    },
  };

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string' || input instanceof URL) {
      const url = input.toString();

      if (url.endsWith('/api/ai/config') && (!init || init.method === 'GET')) {
        return new Response(JSON.stringify(getResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.endsWith('/api/ai/config') && init?.method === 'PUT') {
        const payload = JSON.parse(init.body as string);
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              ...getResponse.data,
              ...payload,
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }

    return new Response(
      JSON.stringify({ success: false, message: 'Endpoint not mocked' }),
      { status: 404 }
    );
  });

  return fetchMock;
};

describe('AiSettingsTab', () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof buildFetchMock>;

  beforeEach(() => {
    fetchMock = buildFetchMock();
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('carrega configurações e permite alterar o modo padrão', async () => {
    await act(async () => {
      render(<AiSettingsTab />);
    });

    await waitFor(() => expect(screen.getByText('Configurações da IA')).toBeInTheDocument());

    const trigger = screen.getByRole('combobox', { name: /modo padrão/i });
    fireEvent.mouseDown(trigger);

    const iaAutoOption = await screen.findByRole('option', { name: 'IA Auto' });
    fireEvent.click(iaAutoOption);

    const salvar = screen.getByRole('button', { name: /Salvar ajustes/i });
    await act(async () => {
      fireEvent.click(salvar);
    });

    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find(
        ([input, init]) =>
          typeof input === 'string' &&
          input.endsWith('/api/ai/config') &&
          init?.method === 'PUT'
      );
      expect(putCall).toBeTruthy();
      const [, init] = putCall!;
      const body = JSON.parse(init?.body as string);
      expect(body.defaultMode).toBe('IA_AUTO');
    });
  });
});
