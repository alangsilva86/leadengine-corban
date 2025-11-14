import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import CreateCampaignWizard from '../CreateCampaignWizard.jsx';

const mockUseAgreements = vi.fn();

vi.mock('@/features/agreements/useAgreements.js', () => ({
  __esModule: true,
  default: () => mockUseAgreements(),
}));

describe('CreateCampaignWizard', () => {
  const defaultProps = {
    open: true,
    agreement: {
      id: 'agreement-1',
      name: 'Convênio Central',
      whatsappProductScope: ['consigned_credit', 'benefit_card'],
    },
    instances: [
      {
        id: 'instance-1',
        name: 'Instância Norte',
        connected: true,
      },
    ],
    defaultInstanceId: 'instance-1',
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
  };

  const buildAgreementsState = () => ({
    agreements: [
      {
        id: 'agreement-1',
        name: 'Convênio Central',
        whatsappProductScope: ['consigned_credit', 'benefit_card'],
      },
    ],
    isLoading: false,
    error: null,
    retry: vi.fn(),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAgreements.mockReturnValue(buildAgreementsState());
  });

  it('keeps progress when advancing to Produto & margem and preserves a custom name on review', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <CreateCampaignWizard {...defaultProps} />
      </MemoryRouter>,
    );

    const advanceButtonStep1 = await screen.findByRole('button', { name: 'Avançar' });
    await user.click(advanceButtonStep1);

    expect(await screen.findByText('Defina a origem de leads')).toBeInTheDocument();

    const advanceButtonStep2 = screen.getByRole('button', { name: 'Avançar' });
    await user.click(advanceButtonStep2);

    expect(await screen.findByText('Escolha o produto e a margem')).toBeInTheDocument();
    expect(screen.queryByText('Escolha a instância')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Crédito consignado/i }));

    await waitFor(() => {
      expect(screen.getByLabelText('Margem alvo (%)')).toHaveValue('1.8');
    });

    await user.click(screen.getByRole('button', { name: 'Avançar' }));

    expect(await screen.findByText('Selecione a estratégia')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /HOT/i }));
    await user.click(screen.getByRole('button', { name: 'Avançar' }));

    const nameInput = await screen.findByLabelText('Nome da campanha');
    await user.clear(nameInput);
    await user.type(nameInput, 'Campanha Personalizada');

    const toProductButton = screen.getByRole('button', { name: /Produto compatível/i });
    await user.click(toProductButton);

    expect(await screen.findByText('Escolha o produto e a margem')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Avançar' }));
    await user.click(screen.getByRole('button', { name: 'Avançar' }));

    const finalNameInput = await screen.findByLabelText('Nome da campanha');
    expect(finalNameInput).toHaveValue('Campanha Personalizada');
  });
});
