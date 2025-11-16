import '@testing-library/jest-dom/vitest';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import ConveniosSettingsTab from '../ConveniosSettingsTab.jsx';

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

const createResizeObserverMock = () =>
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

vi.mock('sonner', () => ({
  toast: toastMock,
}));

const buildFetchMock = (initialAgreements) => {
  const state = {
    agreements:
      initialAgreements ?? [
        {
          id: 'agreement-1',
          nome: 'Convênio A',
          averbadora: 'Org Municipal',
          tipo: 'MUNICIPAL',
          status: 'ATIVO',
          produtos: ['Consignado tradicional'],
          responsavel: 'Ana',
          archived: false,
          janelas: [],
          taxas: [],
          history: [],
          metadata: { providerId: 'provider-1' },
        },
      ],
  };

  const buildResponse = (body, init = {}) =>
    new Response(JSON.stringify(body), {
      status: init.status ?? 200,
      headers: { 'Content-Type': 'application/json' },
    });

  return vi.fn(async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init.method ?? 'GET';

    if (url.endsWith('/api/v1/agreements') && method === 'GET') {
      return buildResponse({
        data: state.agreements,
        meta: { fetchedAt: new Date().toISOString() },
      });
    }

    if (url.endsWith('/api/v1/agreements') && method === 'POST') {
      const created = {
        id: 'agreement-2',
        nome: 'Convênio Criado',
        averbadora: 'Secretaria Municipal',
        tipo: 'MUNICIPAL',
        status: 'EM_IMPLANTACAO',
        produtos: [],
        responsavel: 'Equipe Comercial',
        archived: false,
        janelas: [],
        taxas: [],
        history: [],
        metadata: { providerId: 'provider-1' },
      };
      state.agreements = [created, ...state.agreements];
      return buildResponse({
        data: created,
        meta: { updatedAt: new Date().toISOString() },
      }, { status: 201 });
    }

    if (url.endsWith('/api/v1/agreements/import') && method === 'POST') {
      state.agreements = [
        {
          id: 'agreement-2',
          nome: 'Convênio Importado',
          averbadora: 'Nova Org',
          tipo: 'ESTADUAL',
          status: 'EM_IMPLANTACAO',
          produtos: ['Cartão benefício – Saque'],
          responsavel: 'Bruno',
          archived: false,
          janelas: [],
          taxas: [],
          history: [],
        },
        ...state.agreements,
      ];

      return buildResponse({
        data: { imported: 1, updated: 0, failed: 0, errors: [] },
        meta: { jobId: 'job-1', processedAt: new Date().toISOString() },
      }, { status: 202 });
    }

    if (url.includes('/api/v1/agreements/') && method === 'PATCH') {
      return buildResponse(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'data/meta/error: Nome obrigatório' },
          data: { errors: [{ path: ['nome'], message: 'Nome obrigatório' }] },
        },
        { status: 400 }
      );
    }

    if (url.includes('/api/v1/agreements/providers/') && method === 'POST') {
      return buildResponse(
        {
          data: { providerId: 'provider-1', status: 'queued', syncId: 'sync-1' },
          meta: { queuedAt: new Date().toISOString() },
        },
        { status: 202 }
      );
    }

    return buildResponse({ success: false, message: 'not-mocked' }, { status: 404 });
  });
};

describe('ConveniosSettingsTab', () => {
  const originalFetch = globalThis.fetch;
  let fetchMock;
  let queryClient;

  beforeAll(() => {
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, 'ResizeObserver', {
        configurable: true,
        writable: true,
        value: createResizeObserverMock(),
      });
    }
    if (typeof globalThis !== 'undefined') {
      Object.defineProperty(globalThis, 'ResizeObserver', {
        configurable: true,
        writable: true,
        value: createResizeObserverMock(),
      });
    }
  });

  const renderComponent = async () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    await act(async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <ConveniosSettingsTab />
        </QueryClientProvider>
      );
    });
  };

  beforeEach(() => {
    fetchMock = buildFetchMock();
    globalThis.fetch = fetchMock;
    toastMock.success.mockReset();
    toastMock.error.mockReset();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
    if (queryClient) {
      queryClient.clear();
    }
  });

  it('importa convênios e atualiza a lista com o retorno da API', async () => {
    await renderComponent();
    await waitFor(() => expect(screen.getByText('Convênio A')).toBeInTheDocument());

    const importButton = screen.getByRole('button', { name: /Importar planilha/i });
    await act(async () => {
      fireEvent.click(importButton);
    });

    const fileInput = screen.getByLabelText(/Arquivo de importação/i);
    const file = new File(['id,nome'], 'agreements.csv', { type: 'text/csv' });
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    const submitButton = screen.getByRole('button', { name: /^Importar$/i });
    await act(async () => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith(expect.stringContaining('Importação concluída')));
    await waitFor(() => expect(screen.getByText('Convênio Importado')).toBeInTheDocument());

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/agreements/import', expect.any(Object));
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/agreements', expect.anything());
  });

  it('exibe mensagem de erro seguindo payload da API ao salvar dados básicos inválidos', async () => {
    await renderComponent();
    await waitFor(() => expect(screen.getByText('Convênio A')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByText('Convênio A'));
    });

    await waitFor(() => expect(screen.getByText('Dados básicos')).toBeInTheDocument());

    const nameInput = screen.getByLabelText(/Nome do convênio/i);
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: '' } });
    });

    const saveButton = screen.getByRole('button', { name: /Salvar dados básicos/i });
    await act(async () => {
      fireEvent.click(saveButton);
    });

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith('data/meta/error: Nome obrigatório')
    );
    expect(toastMock.success).not.toHaveBeenCalled();
  });

  it('cria convênio chamando POST /api/v1/agreements e seleciona o retorno da API', async () => {
    await renderComponent();
    await waitFor(() => expect(screen.getByText('Convênio A')).toBeInTheDocument());

    const createButton = screen.getByRole('button', { name: /novo convênio/i });
    await act(async () => {
      fireEvent.click(createButton);
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/v1/agreements', expect.objectContaining({ method: 'POST' })));
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith('Convênio criado'));
  });

  it('impede sincronização quando o convênio não possui providerId', async () => {
    fetchMock = buildFetchMock([
      {
        id: 'agreement-1',
        nome: 'Convênio sem provedor',
        averbadora: 'Org Municipal',
        tipo: 'MUNICIPAL',
        status: 'ATIVO',
        produtos: ['Consignado tradicional'],
        responsavel: 'Ana',
        archived: false,
        janelas: [],
        taxas: [],
        history: [],
        metadata: {},
      },
    ]);
    globalThis.fetch = fetchMock;
    await renderComponent();

    await waitFor(() => expect(screen.getByText('Convênio sem provedor')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByText('Convênio sem provedor'));
    });

    const syncButton = screen.getByRole('button', { name: /Sincronizar provedor/i });
    await act(async () => {
      fireEvent.click(syncButton);
    });

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith('Sincronização disponível apenas para convênios integrados.')
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/agreements/providers/'),
      expect.anything()
    );
  });
});
