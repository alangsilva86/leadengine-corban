/** @vitest-environment jsdom */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import CampaignsPanel from '../CampaignsPanel.jsx';
import { getNumberStatus } from '../../lib/numberStatus';

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

const buildCampaign = (overrides = {}) => ({
  id: 'campaign-1',
  name: 'INSS Cartão • Comercial 1',
  status: 'active',
  agreementId: 'inss',
  agreementName: 'INSS',
  productType: 'benefit_card',
  instanceId: 'instance-1',
  instanceName: 'Comercial 1',
  metrics: { total: 10, contacted: 4, won: 2, lost: 1 },
  updatedAt: new Date().toISOString(),
  metadata: {},
  ...overrides,
});

const numbersById = new Map([
  [
    'instance-1',
    { id: 'instance-1', name: 'Comercial 1', phone: '+55 11 91234-5678', status: getNumberStatus({ status: 'connected', connected: true }) },
  ],
  ['instance-2', { id: 'instance-2', name: 'Retenção', phone: null, status: getNumberStatus({ status: 'disconnected' }) }],
]);

const renderPanel = (props = {}) => {
  const handlers = {
    onPause: vi.fn(),
    onResume: vi.fn(),
    onChangeNumber: vi.fn(),
    onRename: vi.fn(),
    onHistory: vi.fn(),
    onEnd: vi.fn(),
  };
  render(<CampaignsPanel campaigns={[buildCampaign()]} numbersById={numbersById} {...handlers} {...props} />);
  return handlers;
};

describe('CampaignsPanel', () => {
  it('mostra origem · produto, número de destino com status e métricas reais', () => {
    renderPanel({
      campaigns: [
        buildCampaign(),
        buildCampaign({ id: 'campaign-2', agreementName: 'SIAPE', productType: 'consigned_credit', status: 'paused', instanceId: 'instance-2' }),
        buildCampaign({ id: 'campaign-3', agreementName: 'Prefeitura', productType: null, status: 'draft', instanceId: null, instanceName: null }),
      ],
    });

    const first = screen.getByRole('article', { name: 'INSS · Cartão benefício' });
    expect(within(first).getByText('Ativa')).toBeInTheDocument();
    expect(within(first).getByText('Comercial 1')).toBeInTheDocument();
    expect(within(first).getByText('Leads')).toBeInTheDocument();
    expect(within(first).getByText('Contactados')).toBeInTheDocument();
    expect(within(first).getByText('Convertidos')).toBeInTheDocument();
    expect(within(first).queryByText('Ganhos')).not.toBeInTheDocument();

    const second = screen.getByRole('article', { name: 'SIAPE · Crédito consignado' });
    expect(within(second).getByText(/Desconectado/)).toBeInTheDocument();
    expect(within(second).getByRole('button', { name: /Retomar/ })).toBeInTheDocument();

    const third = screen.getByRole('article', { name: 'Prefeitura' });
    expect(within(third).getByText('Sem número')).toBeInTheDocument();
    expect(within(third).getByRole('button', { name: /Ativar/ })).toBeInTheDocument();

    // Sem ids crus na tela.
    expect(screen.queryByText(/campaign-1|instance-1/)).not.toBeInTheDocument();
  });

  it('pausa direto e encerra apenas pedindo confirmação à página', async () => {
    const user = userEvent.setup();
    const handlers = renderPanel();

    await user.click(screen.getByRole('button', { name: /Pausar/ }));
    expect(handlers.onPause).toHaveBeenCalledWith(expect.objectContaining({ id: 'campaign-1' }));

    await user.click(screen.getByRole('button', { name: /Mais ações para INSS · Cartão benefício/ }));
    await user.click(await screen.findByRole('menuitem', { name: /Encerrar regra/ }));
    expect(handlers.onEnd).toHaveBeenCalledWith(expect.objectContaining({ id: 'campaign-1' }));
  });

  it('abre trocar número e histórico pelo menu', async () => {
    const user = userEvent.setup();
    const handlers = renderPanel();

    await user.click(screen.getByRole('button', { name: /Mais ações/ }));
    await user.click(await screen.findByRole('menuitem', { name: /Trocar número/ }));
    expect(handlers.onChangeNumber).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /Mais ações/ }));
    await user.click(await screen.findByRole('menuitem', { name: /Histórico da origem/ }));
    expect(handlers.onHistory).toHaveBeenCalled();
  });

  it('só mostra filtros quando há muitas regras', () => {
    const many = Array.from({ length: 7 }, (_, index) =>
      buildCampaign({ id: `c-${index}`, agreementName: `Origem ${index}`, agreementId: `o-${index}` }),
    );
    renderPanel({ campaigns: many });
    expect(screen.getByRole('combobox', { name: 'Filtrar por origem' })).toBeInTheDocument();
  });
});
