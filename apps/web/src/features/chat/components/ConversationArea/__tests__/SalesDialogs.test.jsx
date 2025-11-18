/* @vitest-environment jsdom */
import { fireEvent, render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import SimulationModal from '../SimulationModal.jsx';
import DealDrawer from '../DealDrawer.jsx';

const mockUseConvenioCatalog = vi.fn();

vi.mock('@/features/agreements/useConvenioCatalog.ts', () => ({
  __esModule: true,
  default: () => mockUseConvenioCatalog(),
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
    mockUseConvenioCatalog.mockReset();
    mockUseConvenioCatalog.mockReturnValue({
      convenios: [
        {
          id: 'inss',
          nome: 'INSS',
          produtos: ['emprestimo', 'cartao'],
          taxas: [
            {
              id: 'tax-1',
              produto: 'emprestimo',
              status: 'ativa',
              validFrom: new Date('2020-01-01'),
              validUntil: new Date('2030-12-31'),
              termOptions: [72, 84],
              bank: { id: 'bank-1', name: 'Banco Teste' },
              table: { id: 'table-1', name: 'Tabela 1' },
            },
          ],
          janelas: [
            {
              id: 'window-1',
              label: 'Disponível',
              start: new Date('2020-01-01'),
              end: new Date('2030-12-31'),
            },
          ],
          archived: false,
        },
      ],
        agreementOptions: [
          {
            value: 'inss',
            label: 'INSS',
            products: [
              { value: 'emprestimo', label: 'Empréstimo consignado' },
              { value: 'cartao', label: 'Cartão consignado' },
            ],
          },
        ],
        productsByAgreement: new Map([
          [
            'inss',
            [
              { value: 'emprestimo', label: 'Empréstimo consignado' },
              { value: 'cartao', label: 'Cartão consignado' },
            ],
          ],
        ]),
      isLoading: false,
      error: null,
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
    const { getByRole, getByPlaceholderText } = render(
      <SimulationModal
        open
        onOpenChange={() => {}}
        onSubmit={onSubmit}
        defaultValues={{ calculationSnapshot: simulationSnapshotMock }}
        stageOptions={[]}
        queueAlerts={[]}
      />,
    );

    const baseValueInput = getByPlaceholderText('Ex.: 350');
    fireEvent.change(baseValueInput, { target: { value: '500' } });

    const submitButton = getByRole('button', { name: /registrar simulação/i });
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
  });

  it('exibe mensagem amigável quando nenhum convênio está disponível', () => {
    mockUseConvenioCatalog.mockReturnValue({
      convenios: [],
      agreementOptions: [],
      productsByAgreement: new Map(),
      isLoading: false,
      error: null,
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

  it('sinaliza erro e não envia simulação com metadata inválida', async () => {
    const onSubmit = vi.fn();
    const { getByRole, getByPlaceholderText, getByText } = render(
      <SimulationModal
        open
        onOpenChange={() => {}}
        onSubmit={onSubmit}
        defaultValues={{ calculationSnapshot: simulationSnapshotMock }}
        stageOptions={[]}
        queueAlerts={[]}
      />,
    );

    const baseValueInput = getByPlaceholderText('Ex.: 350');
    fireEvent.change(baseValueInput, { target: { value: '500' } });

    fireEvent.click(getByText(/opções avançadas/i));

    const metadataInput = getByPlaceholderText('{ }');
    fireEvent.change(metadataInput, { target: { value: 'invalid json' } });

    const submitButton = getByRole('button', { name: /registrar simulação/i });
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(getByText('Metadata deve ser um JSON válido.')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  it('sinaliza erro e não envia deal com metadata inválida', async () => {
    const onSubmit = vi.fn();
    const { getByRole, getByPlaceholderText, getByText } = render(
      <DealDrawer
        open
        onOpenChange={() => {}}
        onSubmit={onSubmit}
        defaultValues={{ calculationSnapshot: dealSnapshotMock }}
        stageOptions={[]}
        queueAlerts={[]}
      />,
    );

    fireEvent.click(getByText(/ver detalhes avançados/i));

    const metadataInput = getByPlaceholderText(/origin/i);
    fireEvent.change(metadataInput, { target: { value: 'invalid json' } });

    const submitButton = getByRole('button', { name: /registrar deal/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(getByText('Metadata deve ser um JSON válido.')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });
});
