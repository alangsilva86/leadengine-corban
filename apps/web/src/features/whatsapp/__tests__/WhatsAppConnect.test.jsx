/** @vitest-environment jsdom */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import WhatsAppConnect, { suggestNumberName } from '../connect/index';
import { getNumberStatus } from '../lib/numberStatus';

const useWhatsAppNumbersMock = vi.hoisted(() => vi.fn());
const diagnosticsEnabledMock = vi.hoisted(() => vi.fn(() => false));

vi.mock('@/lib/features.js', () => ({ isDiagnosticsEnabled: diagnosticsEnabledMock }));

vi.mock('../hooks/useWhatsAppNumbers', () => ({
  __esModule: true,
  default: useWhatsAppNumbersMock,
}));

// O assistente de conexão tem testes próprios do ciclo de QR; aqui só verificamos quem ele recebe.
vi.mock('../components/numbers/ConnectNumberSheet', () => ({
  __esModule: true,
  default: ({ open, target, suggestedName }) =>
    open ? <div data-testid="connect-sheet">{target ? `Conectar ${target.name}` : `Novo: ${suggestedName}`}</div> : null,
}));

vi.mock('../connect/services/campaignService', () => ({
  fetchCampaigns: vi.fn(() => Promise.resolve([{ id: 'c1' }, { id: 'c2' }])),
}));

beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const buildNumber = (overrides = {}) => ({
  id: 'n1',
  name: 'Comercial 1',
  phone: '+55 11 91234-5678',
  status: getNumberStatus({ status: 'connected', connected: true }),
  sentCount: 1284,
  lastActivityAt: new Date().toISOString(),
  lastActivityLabel: 'há 5 minutos',
  isSessionOnly: false,
  raw: { id: 'n1' },
  ...overrides,
});

const baseHook = (overrides = {}) => {
  const numbers = overrides.numbers ?? [];
  const counts = {
    total: numbers.length,
    connected: numbers.filter((n) => n.status.isConnected).length,
    needsAttention: numbers.filter((n) => n.status.needsAttention).length,
    connecting: 0,
  };
  return {
    numbers,
    instances: [],
    ready: true,
    loading: false,
    error: null,
    counts,
    hasConnectedNumber: counts.connected > 0,
    canCreate: true,
    busyNumberId: null,
    refresh: vi.fn(),
    createNumber: vi.fn(),
    removeNumber: vi.fn(() => Promise.resolve()),
    disconnectNumber: vi.fn(() => Promise.resolve()),
    checkStatus: vi.fn(),
    wa: {},
    ...overrides,
  };
};

const renderPage = (initialEntry = '/channels') =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <WhatsAppConnect />
    </MemoryRouter>,
  );

describe('WhatsAppConnect', () => {
  beforeEach(() => {
    useWhatsAppNumbersMock.mockReset();
  });

  it('sem números mostra só o estado vazio focado, com uma única ação principal', async () => {
    useWhatsAppNumbersMock.mockReturnValue(baseHook());
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'WhatsApp' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Conecte seu primeiro número' })).toBeInTheDocument();
    expect(screen.getByText('Celular com WhatsApp ativo')).toBeInTheDocument();
    expect(screen.getByText('Número dedicado ao comercial')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Boas práticas para evitar bloqueio/ })).toBeInTheDocument();

    const connectButtons = screen.getAllByRole('button', { name: /Conectar número/ });
    expect(connectButtons).toHaveLength(1);
    await user.click(connectButtons[0]);
    expect(screen.getByTestId('connect-sheet')).toHaveTextContent('Novo: Comercial 1');

    // Nada de passos, ids ou jargão técnico.
    expect(screen.queryByText(/Passo \d/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Instância|tenant|broker/i)).not.toBeInTheDocument();
  });

  it('libera a criação sem acordo selecionado (empresa vem da sessão)', () => {
    useWhatsAppNumbersMock.mockReturnValue(baseHook({ numbers: [buildNumber()] }));
    renderPage();
    expect(screen.getByRole('button', { name: /Conectar número/ })).toBeEnabled();
  });

  it('lista os números com status legível e resumo no cabeçalho', async () => {
    const pairing = buildNumber({
      id: 'n2',
      name: 'Comercial 2',
      phone: null,
      status: getNumberStatus({ status: 'qr_required' }),
      sentCount: null,
      lastActivityLabel: null,
    });
    useWhatsAppNumbersMock.mockReturnValue(baseHook({ numbers: [buildNumber(), pairing] }));
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByText('1 conectado')).toBeInTheDocument();
    expect(screen.getByText('1 precisa de atenção')).toBeInTheDocument();

    const table = screen.getByRole('table');
    expect(within(table).getByText('+55 11 91234-5678')).toBeInTheDocument();
    expect(within(table).getByText('Conectado')).toBeInTheDocument();
    expect(within(table).getByText('Aguardando pareamento')).toBeInTheDocument();
    expect(within(table).getByText('Ainda não pareado')).toBeInTheDocument();

    await user.click(within(table).getByRole('button', { name: 'Conectar' }));
    expect(screen.getByTestId('connect-sheet')).toHaveTextContent('Conectar Comercial 2');
  });

  it('mostra erro amigável com nova tentativa quando a lista não carrega', async () => {
    const hook = baseHook({
      error: { code: 'WHATSAPP_NOT_CONFIGURED', title: 'WhatsApp ainda não está disponível', message: 'Fale com o suporte.' },
    });
    useWhatsAppNumbersMock.mockReturnValue(hook);
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByText('WhatsApp ainda não está disponível')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Tentar novamente/ }));
    expect(hook.refresh).toHaveBeenCalled();
  });

  it('confirma a exclusão listando as consequências antes de excluir', async () => {
    const hook = baseHook({ numbers: [buildNumber()] });
    useWhatsAppNumbersMock.mockReturnValue(hook);
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getAllByRole('button', { name: /Mais ações para Comercial 1/ })[0]);
    await user.click(await screen.findByRole('menuitem', { name: /Excluir número/ }));

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Excluir Comercial 1?')).toBeInTheDocument();
    expect(within(dialog).getByText(/desconectado do celular/)).toBeInTheDocument();
    await waitFor(() => expect(within(dialog).getByText(/2 regras ativas usam este número/)).toBeInTheDocument());
    expect(hook.removeNumber).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Excluir número' }));
    await waitFor(() => expect(hook.removeNumber).toHaveBeenCalledWith(expect.objectContaining({ id: 'n1' })));
  });

  it('o diagnóstico aponta para a nova página de configurações quando está habilitado', async () => {
    diagnosticsEnabledMock.mockReturnValue(true);
    useWhatsAppNumbersMock.mockReturnValue(baseHook({ numbers: [buildNumber()] }));
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getAllByRole('button', { name: /Mais ações para Comercial 1/ })[0]);
    expect(await screen.findByRole('menuitem', { name: /Ver diagnóstico/ })).toHaveAttribute(
      'href',
      '/settings/diagnostics?instance=n1',
    );
  });

  it('esconde o diagnóstico quando a ferramenta está desligada', async () => {
    diagnosticsEnabledMock.mockReturnValue(false);
    useWhatsAppNumbersMock.mockReturnValue(baseHook({ numbers: [buildNumber()] }));
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getAllByRole('button', { name: /Mais ações para Comercial 1/ })[0]);
    await screen.findByRole('menu');
    expect(screen.queryByRole('menuitem', { name: /Ver diagnóstico/ })).not.toBeInTheDocument();
  });

  it('sugere o próximo nome livre', () => {
    expect(suggestNumberName([{ name: 'Comercial 1' }, { name: 'Comercial 3' }])).toBe('Comercial 2');
  });
});
