/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
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

    expect(screen.getByText('Convênio: Convênio Alpha')).toBeInTheDocument();
    expect(screen.getByText('Convênio: Convênio Beta')).toBeInTheDocument();
    expect(screen.getAllByText('Instância vinculada').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Aguardando vínculo').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Leads recebidos')).toHaveLength(2);
    expect(screen.getAllByText('Contactados')).toHaveLength(2);

    const disconnectButton = screen.getByRole('button', { name: /Desvincular/i });
    await user.click(disconnectButton);
    expect(disconnectMock).toHaveBeenCalledWith(linkedCampaign);

    expect(screen.getByRole('button', { name: /Vincular instância/i })).toBeInTheDocument();
  });
});
