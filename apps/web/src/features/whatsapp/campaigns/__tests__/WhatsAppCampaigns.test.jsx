/** @vitest-environment jsdom */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import WhatsAppCampaigns from '../index';
import { getNumberStatus } from '../../lib/numberStatus';

const useCampaignsPageMock = vi.hoisted(() => vi.fn());

vi.mock('../hooks/useCampaignsPage', () => ({
  __esModule: true,
  default: useCampaignsPageMock,
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

const connected = {
  id: 'n1',
  name: 'Comercial 1',
  phone: '+55 11 91234-5678',
  status: getNumberStatus({ status: 'connected', connected: true }),
};

const campaign = {
  id: 'c1',
  name: 'INSS Cartão',
  status: 'active',
  agreementId: 'inss',
  agreementName: 'INSS',
  productType: 'benefit_card',
  instanceId: 'n1',
  instanceName: 'Comercial 1',
  metrics: { total: 12, contacted: 6, won: 1 },
  updatedAt: new Date().toISOString(),
};

const buildPage = (overrides = {}) => {
  const numbersList = overrides.numbersList ?? [connected];
  const campaigns = overrides.campaigns ?? [];
  return {
    numbers: {
      ready: true,
      numbers: numbersList,
      instances: numbersList.map((n) => ({ id: n.id, name: n.name, connected: n.status.isConnected })),
    },
    numbersById: new Map(numbersList.map((n) => [n.id, n])),
    counts: {
      active: campaigns.filter((c) => c.status === 'active').length,
      paused: campaigns.filter((c) => c.status === 'paused').length,
      draft: 0,
      withoutNumber: campaigns.filter((c) => !c.instanceId).length,
    },
    campaigns,
    campaignsLoaded: true,
    campaignError: null,
    campaignAction: null,
    canCreateCampaigns: numbersList.some((n) => n.status.isConnected),
    isCreateCampaignOpen: false,
    setCreateCampaignOpen: vi.fn(),
    pendingReassign: null,
    setPendingReassign: vi.fn(),
    reassignIntent: 'reassign',
    setReassignIntent: vi.fn(),
    reloadCampaigns: vi.fn(),
    updateCampaignStatus: vi.fn(() => Promise.resolve()),
    deleteCampaign: vi.fn(() => Promise.resolve()),
    reassignCampaign: vi.fn(),
    renameCampaign: vi.fn(),
    createCampaign: vi.fn(),
    fetchCampaignImpact: vi.fn(),
    ...overrides,
  };
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <WhatsAppCampaigns />
    </MemoryRouter>,
  );

describe('WhatsAppCampaigns', () => {
  beforeEach(() => {
    useCampaignsPageMock.mockReset();
  });

  it('sem número conectado mostra o pré-requisito, sem sobrepor a página', () => {
    useCampaignsPageMock.mockReturnValue(buildPage({ numbersList: [] }));
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Regras de roteamento' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Conecte um número para criar regras de roteamento' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Conectar número' })).toHaveAttribute('href', '/channels?connect=1');
    expect(screen.getByRole('button', { name: /Nova regra/ })).toBeDisabled();
    // Sem textos colados de onboarding, badges de tenant ou CTA duplicado.
    expect(screen.queryByText(/Tenant|Passo \d|Configure regra/)).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Nova regra/ })).toHaveLength(1);
  });

  it('com números desconectados aponta para a lista de números', () => {
    useCampaignsPageMock.mockReturnValue(
      buildPage({ numbersList: [{ ...connected, status: getNumberStatus({ status: 'disconnected' }) }] }),
    );
    renderPage();
    expect(screen.getByRole('heading', { name: 'Nenhum número conectado agora' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver números' })).toHaveAttribute('href', '/channels');
  });

  it('com número conectado e sem regras mostra um estado vazio com ação', async () => {
    const page = buildPage();
    useCampaignsPageMock.mockReturnValue(page);
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByText('Nenhuma regra de roteamento ainda')).toBeInTheDocument();
    const buttons = screen.getAllByRole('button', { name: /Nova regra/ });
    buttons.forEach((button) => expect(button).toBeEnabled());
    await user.click(buttons[0]);
    expect(page.setCreateCampaignOpen).toHaveBeenCalledWith(true);
  });

  it('encerra a regra somente após confirmação', async () => {
    const page = buildPage({ campaigns: [campaign] });
    useCampaignsPageMock.mockReturnValue(page);
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByText('1 ativa')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Mais ações para INSS · Cartão benefício/ }));
    await user.click(await screen.findByRole('menuitem', { name: /Encerrar regra/ }));

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Encerrar INSS · Cartão benefício?')).toBeInTheDocument();
    expect(page.deleteCampaign).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Encerrar regra' }));
    await waitFor(() => expect(page.deleteCampaign).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1' })));
  });

  it('mostra erro de carregamento com nova tentativa', async () => {
    const page = buildPage({ campaignError: 'O serviço está instável.' });
    useCampaignsPageMock.mockReturnValue(page);
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByText('Não foi possível carregar as regras')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Tentar novamente/ }));
    expect(page.reloadCampaigns).toHaveBeenCalled();
  });
});
