/* @vitest-environment jsdom */
import { fireEvent, render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import SimulationModal from '../SimulationModal.jsx';
import DealDrawer from '../DealDrawer.jsx';

const mockUseAgreements = vi.fn();

vi.mock('@/features/agreements/useAgreements.js', () => ({
  __esModule: true,
  default: () => mockUseAgreements(),
}));

const queueAlertSample = {
  payload: {
    message: 'Fila indisponível no momento.',
    reason: 'whatsapp.queue.missing',
    instanceId: 'instance-001',
  },
};

const simulationSnapshotMock = {
  type: 'simulation',
  convenio: { id: 'inss', label: 'INSS' },
  product: { id: 'emprestimo', label: 'Empréstimo consignado' },
  offers: [
    {
      id: 'offer-1',
      bankName: 'Banco Teste',
      table: 'Tabela 1',
      terms: [
        { id: 'term-1', term: 12, installment: 200, netAmount: 4000, selected: true },
      ],
    },
  ],
};

const dealSnapshotMock = {
  type: 'deal',
  bank: { label: 'Banco Teste' },
  term: 12,
  installment: 200,
  netAmount: 4000,
  totalAmount: 4500,
  proposalId: 'proposal-1',
  simulationId: 'simulation-1',
};

describe('Sales dialogs alerts', () => {
  beforeEach(() => {
    mockUseAgreements.mockReset();
    mockUseAgreements.mockReturnValue({
      agreements: [
        {
          id: 'inss',
          name: 'INSS',
          products: [
            { id: 'emprestimo', label: 'Empréstimo consignado' },
            { id: 'cartao_consignado', label: 'Cartão consignado' },
          ],
        },
      ],
      isLoading: false,
      error: null,
      retry: vi.fn(),
    });
  });

  it('bloqueia submissão da simulação quando há alertas da fila', () => {
    const onSubmit = vi.fn();
    const { getByRole, getByText } = render(
      <SimulationModal
        open
        onOpenChange={() => {}}
        onSubmit={onSubmit}
        defaultValues={{ calculationSnapshot: simulationSnapshotMock }}
        stageOptions={[]}
        queueAlerts={[queueAlertSample]}
        disabledReason="Fila padrão indisponível para registrar operações."
        disabled
      />,
    );

    expect(getByText('Fila padrão indisponível')).toBeInTheDocument();
    expect(getByText('Fila indisponível no momento.')).toBeInTheDocument();
    expect(getByText(/Instância afetada:/)).toBeInTheDocument();

    const submitButton = getByRole('button', { name: /registrar simulação/i });
    expect(submitButton).toBeDisabled();

    fireEvent.click(submitButton);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('envia simulação quando não há bloqueios', async () => {
    const onSubmit = vi.fn().mockResolvedValue();
    const { getByRole } = render(
      <SimulationModal
        open
        onOpenChange={() => {}}
        onSubmit={onSubmit}
        defaultValues={{ calculationSnapshot: simulationSnapshotMock }}
        stageOptions={[]}
        queueAlerts={[]}
      />,
    );

    const submitButton = getByRole('button', { name: /registrar simulação/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
  });

  it('exibe mensagem amigável quando nenhum convênio está disponível', () => {
    mockUseAgreements.mockReturnValueOnce({
      agreements: [],
      isLoading: false,
      error: null,
      retry: vi.fn(),
    });

    const { getByText } = render(
      <SimulationModal
        open
        onOpenChange={() => {}}
        onSubmit={vi.fn()}
        defaultValues={{ calculationSnapshot: simulationSnapshotMock }}
        stageOptions={[]}
        queueAlerts={[]}
      />,
    );

    expect(
      getByText(
        'Nenhum convênio disponível no momento. Configure um convênio para liberar o cadastro.',
      ),
    ).toBeInTheDocument();
  });

  it('bloqueia submissão do deal e desabilita campos quando há alertas', () => {
    const onSubmit = vi.fn();
    const { getByRole, getByLabelText } = render(
      <DealDrawer
        open
        onOpenChange={() => {}}
        onSubmit={onSubmit}
        defaultValues={{ calculationSnapshot: dealSnapshotMock }}
        stageOptions={[]}
        queueAlerts={[queueAlertSample]}
        disabled
        disabledReason="Fila padrão indisponível para registrar deals."
      />,
    );

    const leadInput = getByLabelText(/Lead \(opcional\)/i);
    expect(leadInput).toBeDisabled();

    const submitButton = getByRole('button', { name: /registrar deal/i });
    expect(submitButton).toBeDisabled();

    fireEvent.click(submitButton);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('envia deal quando campos estão válidos e não há alertas', async () => {
    const onSubmit = vi.fn().mockResolvedValue();
    const { getByRole } = render(
      <DealDrawer
        open
        onOpenChange={() => {}}
        onSubmit={onSubmit}
        defaultValues={{ calculationSnapshot: dealSnapshotMock }}
        stageOptions={[]}
        queueAlerts={[]}
      />,
    );

    const submitButton = getByRole('button', { name: /registrar deal/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
  });
});
