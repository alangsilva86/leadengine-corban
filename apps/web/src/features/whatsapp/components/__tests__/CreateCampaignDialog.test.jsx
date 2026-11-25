/** @vitest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import CreateCampaignDialog from '../CreateCampaignDialog.jsx';
import { TOTAL_STEPS } from '../CreateCampaignWizard.jsx';

const buildInstance = (overrides = {}) => ({
  id: 'instance-1',
  name: 'Comercial 1',
  connected: true,
  status: 'connected',
  metadata: {},
  ...overrides,
});

beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
});

const renderDialog = (props) =>
  render(
    <MemoryRouter>
      <CreateCampaignDialog open onOpenChange={vi.fn()} agreement={null} defaultInstanceId="instance-1" {...props} />
    </MemoryRouter>,
  );

const expectStep = async (stepNumber) => {
  await waitFor(() => {
    expect(screen.getByText(new RegExp(`Etapa ${stepNumber} de ${TOTAL_STEPS}`))).toBeInTheDocument();
  });
};

describe('CreateCampaignDialog wizard', () => {
  it('configura a regra nas 5 etapas e envia exatamente o mesmo payload', async () => {
    const onSubmit = vi.fn(async () => {});
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    renderDialog({
      onOpenChange,
      instances: [buildInstance(), buildInstance({ id: 'instance-2', name: 'Comercial 2' })],
      onSubmit,
    });

    await expectStep(1);
    await user.click(screen.getByRole('button', { name: /^Avançar$/ }));

    await expectStep(2);
    await user.type(screen.getByLabelText('Nome da origem'), 'Convênio Beta');
    const codeInput = screen.getByLabelText('Código da origem');
    expect(codeInput).toHaveValue('convenio-beta');
    await user.clear(codeInput);
    await user.type(codeInput, 'agreement-2');
    await user.click(screen.getByRole('button', { name: /^Avançar$/ }));

    await expectStep(3);
    await user.click(screen.getByRole('button', { name: /Cartão benefício/i }));
    const marginInput = screen.getByLabelText(/Margem alvo/);
    expect(marginInput).toHaveValue('0.9');
    await user.clear(marginInput);
    await user.type(marginInput, '1,2');
    expect(marginInput).toHaveValue('1.2');
    await user.click(screen.getByRole('button', { name: /^Avançar$/ }));

    await expectStep(4);
    await user.click(screen.getByRole('button', { name: /Acompanhamento ativo/i }));
    // Estratégia proativa exige a confirmação de consentimento.
    await user.click(screen.getByRole('button', { name: /^Avançar$/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('autorizaram receber mensagens');
    await user.click(screen.getByRole('checkbox', { name: /autorizaram receber mensagens/i }));
    await user.click(screen.getByRole('button', { name: /^Avançar$/ }));

    await expectStep(5);
    const nameInput = screen.getByLabelText(/Nome da regra/i);
    expect(nameInput).toHaveValue('Convênio Beta · Cartão benefício');
    await user.clear(nameInput);
    await user.type(nameInput, 'Regra Especial');
    await user.click(screen.getByRole('button', { name: /Criar regra/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Regra Especial',
      status: 'active',
      instanceId: 'instance-1',
      agreementId: 'agreement-2',
      agreementName: 'Convênio Beta',
      leadSource: 'inbound',
      product: 'benefit_card',
      margin: 1.2,
      strategy: 'proactive_followup',
      segments: [],
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  }, 20000);

  it('bloqueia o avanço quando nenhum número conectado está disponível', () => {
    const onSubmit = vi.fn();
    renderDialog({
      instances: [buildInstance({ connected: false, status: 'disconnected' })],
      onSubmit,
    });

    expect(screen.getByRole('button', { name: /^Avançar$/ })).toBeDisabled();
    expect(screen.getByRole('radio', { name: /Comercial 1/ })).toBeDisabled();
    expect(screen.getByRole('link', { name: /Reconectar em WhatsApp/ })).toHaveAttribute('href', '/channels');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('exibe mensagem de erro quando a criação falha', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new Error('Falha na API'));

    renderDialog({ instances: [buildInstance()], onSubmit });

    await user.click(screen.getByRole('button', { name: /^Avançar$/ }));
    await user.type(screen.getByLabelText('Nome da origem'), 'INSS');
    await user.click(screen.getByRole('button', { name: /^Avançar$/ }));
    await user.click(screen.getByRole('button', { name: /Crédito consignado/i }));
    await user.click(screen.getByRole('button', { name: /^Avançar$/ }));
    await user.click(screen.getByRole('button', { name: /Resposta imediata/i }));
    await user.click(screen.getByRole('button', { name: /^Avançar$/ }));
    await user.click(screen.getByRole('button', { name: /Criar regra/i }));

    expect(await screen.findByText(/Falha na API/)).toBeInTheDocument();
  }, 15000);
});
