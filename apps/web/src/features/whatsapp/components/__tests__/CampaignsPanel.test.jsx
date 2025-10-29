/** @vitest-environment jsdom */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';

import CampaignsPanel from '../CampaignsPanel.jsx';

const buildCampaign = (overrides = {}) => ({
  id: `campaign-${Math.random().toString(36).slice(2, 8)}`,
  name: 'Campanha WhatsApp',
  status: 'active',
  agreementId: 'agreement-1',
  agreementName: 'Convênio Alpha',
  instanceId: 'instance-1',
  instanceName: 'Instância Alpha',
  metrics: { total: 10, contacted: 4, won: 2, lost: 1 },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

describe('CampaignsPanel', () => {
  it('exibe convênio, estado de vínculo e permite desvincular a instância', async () => {
    const linkedCampaign = buildCampaign();
    const awaitingCampaign = buildCampaign({
      id: 'campaign-2',
      name: 'Campanha sem instância',
      status: 'paused',
      agreementId: 'agreement-2',
      agreementName: 'Convênio Beta',
      instanceId: null,
      instanceName: null,
    });

    const disconnectMock = vi.fn();
    const user = userEvent.setup();

    render(
      <CampaignsPanel
        agreementName="Convênio Alpha"
        campaigns={[linkedCampaign, awaitingCampaign]}
        loading={false}
        error={null}
        onRefresh={vi.fn()}
        onCreateClick={vi.fn()}
        onPause={vi.fn()}
        onActivate={vi.fn()}
        onDelete={vi.fn()}
        onReassign={vi.fn()}
        onDisconnect={disconnectMock}
        actionState={null}
        selectedInstanceId="instance-1"
        canCreateCampaigns
      />
    );

    expect(screen.getAllByText(/Convênio Alpha/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Convênio Beta/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Instância vinculada').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Aguardando vínculo').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Leads recebidos')).toHaveLength(2);
    expect(screen.getAllByText('Contactados')).toHaveLength(2);

    const [firstActionsButton, secondActionsButton] = screen.getAllByRole('button', {
      name: /Ações/i,
    });

    await user.click(firstActionsButton);
    const disconnectMenuItem = await screen.findByRole('menuitem', {
      name: /Desvincular instância/i,
    });
    await user.click(disconnectMenuItem);
    expect(disconnectMock).toHaveBeenCalledWith(linkedCampaign);

    await user.click(secondActionsButton);
    expect(
      await screen.findByRole('menuitem', { name: /Vincular instância/i }),
    ).toBeInTheDocument();
  });

  it('permite atualizar a lista e desabilita criação quando necessário', async () => {
    const campaigns = [
      buildCampaign({ id: 'campaign-1', status: 'active' }),
      buildCampaign({ id: 'campaign-2', status: 'paused', instanceId: null }),
    ];

    const onRefresh = vi.fn();
    const onCreateClick = vi.fn();
    const user = userEvent.setup();

    const { rerender, container } = render(
      <CampaignsPanel
        agreementName="Convênio Controlado"
        campaigns={campaigns}
        loading={false}
        error={null}
        onRefresh={onRefresh}
        onCreateClick={onCreateClick}
        onPause={vi.fn()}
        onActivate={vi.fn()}
        onDelete={vi.fn()}
        onReassign={vi.fn()}
        onDisconnect={vi.fn()}
        actionState={null}
        selectedInstanceId="instance-1"
        canCreateCampaigns={false}
      />
    );

    const getHeaderScope = () => {
      const panelRoot = container.firstElementChild ?? container;
      const panelScope = within(panelRoot);
      const panelTitle = panelScope.getByText(/Painel de campanhas/i);
      const header = panelTitle.closest('[data-slot="card-header"]');
      expect(header).toBeTruthy();
      return within(header);
    };

    const headerScope = getHeaderScope();
    const refreshButton = headerScope.getByRole('button', { name: /Atualizar/i });
    const createButton = headerScope.getByRole('button', { name: /Nova campanha/i });

    expect(createButton).toBeDisabled();

    await user.click(refreshButton);
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onCreateClick).not.toHaveBeenCalled();

    rerender(
      <CampaignsPanel
        agreementName="Convênio Controlado"
        campaigns={campaigns}
        loading
        error={null}
        onRefresh={onRefresh}
        onCreateClick={onCreateClick}
        onPause={vi.fn()}
        onActivate={vi.fn()}
        onDelete={vi.fn()}
        onReassign={vi.fn()}
        onDisconnect={vi.fn()}
        actionState={null}
        selectedInstanceId="instance-1"
        canCreateCampaigns={false}
      />
    );

    expect(getHeaderScope().getByRole('button', { name: /Atualizar/i })).toBeDisabled();
  });
});
