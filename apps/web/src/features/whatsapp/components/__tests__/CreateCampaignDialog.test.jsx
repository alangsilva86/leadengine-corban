/** @vitest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import CreateCampaignDialog from '../CreateCampaignDialog.jsx';

const useAgreementsMock = vi.fn();

vi.mock('@/features/agreements/useAgreements.js', () => ({
  __esModule: true,
  default: () => useAgreementsMock(),
}));

const buildAgreementsState = (overrides = {}) => ({
  agreements: [
    { id: 'agreement-1', name: 'Convênio Alpha', region: 'SP' },
    { id: 'agreement-2', name: 'Convênio Beta' },
  ],
  isLoading: false,
  error: null,
  retry: vi.fn(),
  fetch: vi.fn(),
  ...overrides,
});

const buildInstance = (overrides = {}) => ({
  id: 'instance-1',
  name: 'Instância A',
  connected: true,
  metadata: {},
  ...overrides,
});

describe('CreateCampaignDialog wizard', () => {
  beforeEach(() => {
    useAgreementsMock.mockReturnValue(buildAgreementsState());
  });

  it('permite configurar a campanha em múltiplos passos e envia o payload completo', async () => {
    const onSubmit = vi.fn(async () => {});
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    render(
      <CreateCampaignDialog
        open
        onOpenChange={onOpenChange}
        agreement={{ id: 'agreement-1', name: 'Convênio Alpha' }}
        instances={[buildInstance(), buildInstance({ id: 'instance-2', name: 'Instância B', connected: true })]}
        defaultInstanceId="instance-1"
        onSubmit={onSubmit}
      />
    );

    await user.click(screen.getByRole('button', { name: /Avançar/i }));

    await user.click(screen.getByRole('combobox', { name: /^Convênio$/i }));
    await user.click(await screen.findByRole('option', { name: /Convênio Beta/i }));

    await user.click(screen.getByRole('button', { name: /Avançar/i }));

    await user.click(screen.getByRole('button', { name: /Cartão benefício/i }));
    const marginInput = screen.getByLabelText(/Margem alvo/);
    expect(marginInput).toHaveValue('0.9');
    await user.clear(marginInput);
    await user.type(marginInput, '1,2');
    expect(marginInput).toHaveValue('1.2');

    await user.click(screen.getByRole('button', { name: /Avançar/i }));

    await user.click(screen.getByRole('button', { name: /^WARM/i }));

    await user.click(screen.getByRole('button', { name: /Avançar/i }));

    const nameInput = screen.getByLabelText(/Nome da campanha/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Campanha Especial');

    await user.click(screen.getByRole('button', { name: /Criar campanha/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Campanha Especial',
      status: 'active',
      instanceId: 'instance-1',
      agreementId: 'agreement-2',
      agreementName: 'Convênio Beta',
      product: 'benefit_card',
      margin: 1.2,
      strategy: 'proactive_followup',
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('bloqueia avanço quando a instância selecionada não está conectada', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <CreateCampaignDialog
        open
        onOpenChange={vi.fn()}
        agreement={null}
        instances={[buildInstance({ connected: false })]}
        defaultInstanceId="instance-1"
        onSubmit={onSubmit}
      />
    );

    const advanceButton = screen.getByRole('button', { name: /Avançar/i });
    expect(advanceButton).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('exibe mensagem de erro quando a criação falha', async () => {
    const user = userEvent.setup();
    const error = new Error('Falha na API');
    const onSubmit = vi.fn().mockRejectedValue(error);

    render(
      <CreateCampaignDialog
        open
        onOpenChange={vi.fn()}
        agreement={{ id: 'agreement-1', name: 'Convênio Alpha' }}
        instances={[buildInstance()]}
        defaultInstanceId="instance-1"
        onSubmit={onSubmit}
      />
    );

    await user.click(screen.getByRole('button', { name: /Avançar/i }));

    await user.click(screen.getByRole('combobox', { name: /^Convênio$/i }));
    await user.click(await screen.findByRole('option', { name: /Convênio Alpha/i }));

    await user.click(screen.getByRole('button', { name: /Avançar/i }));
    await user.click(screen.getByRole('button', { name: /Crédito consignado/i }));

    await user.click(screen.getByRole('button', { name: /Avançar/i }));
    await user.click(screen.getByRole('button', { name: /^HOT/i }));

    await user.click(screen.getByRole('button', { name: /Avançar/i }));
    await user.click(screen.getByRole('button', { name: /Criar campanha/i }));

    expect(await screen.findByText(/Falha na API/)).toBeInTheDocument();
  });
});
