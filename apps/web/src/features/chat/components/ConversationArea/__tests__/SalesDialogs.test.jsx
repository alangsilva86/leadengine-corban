/* @vitest-environment jsdom */
import { fireEvent, render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import SimulationModal from '../SimulationModal.jsx';
import DealDrawer from '../DealDrawer.jsx';

const queueAlertSample = {
  payload: {
    message: 'Fila indisponível no momento.',
    reason: 'whatsapp.queue.missing',
    instanceId: 'instance-001',
  },
};

describe('Sales dialogs alerts', () => {
  it('bloqueia submissão da simulação quando há alertas da fila', () => {
    const onSubmit = vi.fn();
    const { getByRole, getByText, getByLabelText } = render(
      <SimulationModal
        open
        onOpenChange={() => {}}
        onSubmit={onSubmit}
        defaultValues={{ calculationSnapshot: { total: 1000 } }}
        stageOptions={[]}
        queueAlerts={[queueAlertSample]}
        disabledReason="Fila padrão indisponível para registrar operações."
        disabled
      />,
    );

    expect(getByText('Fila padrão indisponível')).toBeInTheDocument();
    expect(getByText('Fila indisponível no momento.')).toBeInTheDocument();
    expect(getByText(/Instância afetada:/)).toBeInTheDocument();

    const snapshotField = getByLabelText(/Snapshot de cálculo/i);
    expect(snapshotField).toBeDisabled();

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
        defaultValues={{ calculationSnapshot: { total: 2000 } }}
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

  it('bloqueia submissão do deal e desabilita campos quando há alertas', () => {
    const onSubmit = vi.fn();
    const { getByRole, getByLabelText } = render(
      <DealDrawer
        open
        onOpenChange={() => {}}
        onSubmit={onSubmit}
        defaultValues={{ calculationSnapshot: { approved: true } }}
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
        defaultValues={{ calculationSnapshot: { approved: true } }}
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
