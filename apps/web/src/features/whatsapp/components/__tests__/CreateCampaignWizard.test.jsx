/** @vitest-environment jsdom */
import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import CreateCampaignWizard from '../CreateCampaignWizard.jsx';

beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
});

describe('CreateCampaignWizard', () => {
  const defaultProps = {
    open: true,
    agreement: { id: 'agreement-1', name: 'Convênio Central' },
    instances: [{ id: 'instance-1', name: 'Comercial Norte', connected: true, status: 'connected' }],
    defaultInstanceId: 'instance-1',
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWizard = (props = {}) =>
    render(
      <MemoryRouter>
        <CreateCampaignWizard {...defaultProps} {...props} />
      </MemoryRouter>,
    );

  it('usa a origem recebida por props, mantém o progresso e preserva o nome personalizado', async () => {
    const user = userEvent.setup();
    renderWizard();

    expect(screen.getByRole('button', { name: /Número/ })).toHaveAttribute('aria-current', 'step');
    await user.click(await screen.findByRole('button', { name: 'Avançar' }));

    expect(await screen.findByText('De onde vêm os leads?')).toBeInTheDocument();
    // Antes, a origem selecionada quebrava o assistente (ReferenceError). Agora ela pré-preenche a etapa.
    expect(screen.getByLabelText('Nome da origem')).toHaveValue('Convênio Central');
    expect(screen.getByLabelText('Código da origem')).toHaveValue('agreement-1');
    await user.click(screen.getByRole('button', { name: 'Avançar' }));

    expect(await screen.findByText('Qual produto será oferecido?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Crédito consignado/i }));
    await waitFor(() => expect(screen.getByLabelText('Margem alvo (%)')).toHaveValue('1.8'));
    await user.click(screen.getByRole('button', { name: 'Avançar' }));

    expect(await screen.findByText('Como o time vai atender?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Resposta imediata/i }));
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Avançar' }));

    const nameInput = await screen.findByLabelText('Nome da regra');
    await user.clear(nameInput);
    await user.type(nameInput, 'Regra Personalizada');

    await user.click(screen.getByRole('button', { name: 'Alterar produto' }));
    expect(await screen.findByText('Qual produto será oferecido?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Avançar' }));
    await user.click(screen.getByRole('button', { name: 'Avançar' }));

    expect(await screen.findByLabelText('Nome da regra')).toHaveValue('Regra Personalizada');
  }, 15000);

  it('desabilita de verdade as etapas bloqueadas', () => {
    renderWizard({ agreement: null });
    expect(screen.getByRole('button', { name: /Produto/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Revisão/ })).toBeDisabled();
  });

  it('não mostra jargão técnico nas estratégias', async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.click(screen.getByRole('button', { name: 'Avançar' }));
    await user.click(screen.getByRole('button', { name: 'Avançar' }));
    await user.click(screen.getByRole('button', { name: /Cartão benefício/i }));
    await user.click(screen.getByRole('button', { name: 'Avançar' }));
    expect(await screen.findByRole('button', { name: /Nutrição gradual/ })).toBeInTheDocument();
    expect(screen.queryByText(/^(HOT|WARM|COLD)$/)).not.toBeInTheDocument();
  }, 15000);
});
