/** @vitest-environment jsdom */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import ReassignCampaignDialog from '../ReassignCampaignDialog.jsx';

const baseCampaign = {
  id: 'campaign-1',
  name: 'Campanha Principal',
  status: 'active',
  agreementId: 'agreement-1',
  agreementName: 'Convênio Alpha',
  instanceId: 'instance-1',
  instanceName: 'Instância Alpha',
  updatedAt: new Date().toISOString(),
};

const instances = [
  { id: 'instance-1', name: 'Instância Alpha' },
  { id: 'instance-2', name: 'Instância Beta' },
];

beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
});

describe('ReassignCampaignDialog', () => {
  it('permite desvincular a campanha enviando instanceId null', async () => {
    const onSubmit = vi.fn(() => Promise.resolve());
    const user = userEvent.setup();

    render(
      <ReassignCampaignDialog
        open
        campaign={baseCampaign}
        instances={instances}
        onClose={vi.fn()}
        onSubmit={onSubmit}
        fetchImpact={vi.fn(() => Promise.resolve({ summary: null }))}
      />
    );

    await user.click(screen.getByRole('combobox'));
    const detachOption = await screen.findByRole('option', {
      name: /Sem instância \(aguardando vínculo\)/i,
    });
    await user.click(detachOption);
    await user.click(screen.getByRole('button', { name: /Aplicar alterações/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ instanceId: null });
    });
  });

  it('preseleciona desvincular quando intent é disconnect', async () => {
    render(
      <ReassignCampaignDialog
        open
        campaign={{ ...baseCampaign, instanceId: 'instance-1' }}
        instances={instances}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        fetchImpact={vi.fn(() => Promise.resolve({ summary: null }))}
        intent="disconnect"
      />
    );

    const trigger = screen.getByRole('combobox');
    expect(
      within(trigger).getByText(/Sem instância \(aguardando vínculo\)/i)
    ).toBeInTheDocument();
  });
});
