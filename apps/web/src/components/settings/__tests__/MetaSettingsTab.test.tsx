import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import MetaSettingsTab from '../MetaSettingsTab';

const buildFetchMock = () => {
  const state = {
    config: {
      offlineEventSetId: 'set-123',
      pixelId: 'pixel-123',
      businessId: 'biz-999',
      appId: 'app-777',
      actionSource: 'phone_call',
      eventName: 'Lead',
      reprocessUnmatched: false,
      reprocessUnsent: true,
      reprocessWindowDays: 14,
      connected: true,
      lastValidatedAt: '2024-10-02T15:00:00.000Z',
      lastValidationError: null,
      accessTokenConfigured: true,
      appSecretConfigured: false,
    },
  };

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();

    if (url.endsWith('/api/integrations/meta/offline-conversions/config') && (!init || init.method === 'GET')) {
      return new Response(
        JSON.stringify({ success: true, data: state.config }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (url.endsWith('/api/integrations/meta/offline-conversions/config') && init?.method === 'PUT') {
      const payload = JSON.parse(init.body as string);
      const nextOfflineEventSetId = payload.offlineEventSetId ?? state.config.offlineEventSetId;
      const nextAccessTokenConfigured =
        payload.accessToken !== undefined ? Boolean(payload.accessToken) : state.config.accessTokenConfigured;
      const nextAppSecretConfigured =
        payload.appSecret !== undefined ? Boolean(payload.appSecret) : state.config.appSecretConfigured;

      state.config = {
        ...state.config,
        ...payload,
        offlineEventSetId: nextOfflineEventSetId,
        accessTokenConfigured: nextAccessTokenConfigured,
        appSecretConfigured: nextAppSecretConfigured,
        connected: Boolean(nextOfflineEventSetId && nextAccessTokenConfigured),
      };
      state.config.lastValidatedAt = '2024-10-02T16:00:00.000Z';
      return new Response(
        JSON.stringify({ success: true, data: state.config }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ success: false, message: 'Endpoint não mockado' }), { status: 404 });
  });

  return fetchMock;
};

describe('MetaSettingsTab', () => {
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

  it('carrega configurações e exibe o status da conexão', async () => {
    await act(async () => {
      render(<MetaSettingsTab />);
    });

    await waitFor(() => expect(screen.getByText('Meta conectado')).toBeInTheDocument());

    expect(screen.getByDisplayValue('set-123')).toBeInTheDocument();
    expect(screen.getByDisplayValue('pixel-123')).toBeInTheDocument();
    expect(screen.getByText(/Última validação:/i)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/integrations/meta/offline-conversions/config', undefined);
  });

  it('permite salvar alterações e envia segredos quando editados', async () => {
    await act(async () => {
      render(<MetaSettingsTab />);
    });

    await waitFor(() => expect(screen.getByText('Meta conectado')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/Offline Event Set ID/i), { target: { value: 'set-999' } });
    fireEvent.change(screen.getByLabelText(/Janela de reprocessamento/i), { target: { value: '45' } });
    const accessTokenInput = screen.getByLabelText(/Access Token/i);
    fireEvent.change(accessTokenInput, { target: { value: 'token-new' } });
    const appSecretInput = screen.getByLabelText(/App Secret/i);
    fireEvent.change(appSecretInput, { target: { value: 'secret-new' } });
    const reprocessSwitch = screen.getByRole('switch', { name: /Reprocessar contatos sem correspondência/i });
    fireEvent.click(reprocessSwitch);

    const saveButton = screen.getByRole('button', { name: /Salvar configurações/i });
    await act(async () => {
      fireEvent.click(saveButton);
    });

    await waitFor(() => expect(screen.getByText(/Configurações salvas com sucesso/i)).toBeInTheDocument());

    const putCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT');
    expect(putCall).toBeTruthy();
    const [, init] = putCall!;
    const body = JSON.parse(init?.body as string);
    expect(body).toMatchObject({
      offlineEventSetId: 'set-999',
      reprocessWindowDays: 45,
      reprocessUnmatched: true,
      accessToken: 'token-new',
      appSecret: 'secret-new',
    });
  });

  it('exibe erro quando a API de salvamento retorna falha', async () => {
    const fallbackConfig = {
      offlineEventSetId: null,
      pixelId: null,
      businessId: null,
      appId: null,
      actionSource: null,
      eventName: null,
      reprocessUnmatched: false,
      reprocessUnsent: false,
      reprocessWindowDays: null,
      connected: false,
      lastValidatedAt: null,
      lastValidationError: null,
      accessTokenConfigured: false,
      appSecretConfigured: false,
    };

    const errorFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/integrations/meta/offline-conversions/config') && (!init || init.method === 'GET')) {
        return new Response(JSON.stringify({ success: true, data: fallbackConfig }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.endsWith('/api/integrations/meta/offline-conversions/config') && init?.method === 'PUT') {
        return new Response(JSON.stringify({ message: 'Falha ao validar credenciais' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ success: false }), { status: 404 });
    });

    globalThis.fetch = errorFetch as unknown as typeof globalThis.fetch;

    await act(async () => {
      render(<MetaSettingsTab />);
    });

    await waitFor(() => expect(screen.getByText('Meta desconectado')).toBeInTheDocument());

    const saveButton = screen.getByRole('button', { name: /Salvar configurações/i });
    await act(async () => {
      fireEvent.click(saveButton);
    });

    await waitFor(() => expect(screen.getByText(/Falha ao validar credenciais/i)).toBeInTheDocument());
  });
});
