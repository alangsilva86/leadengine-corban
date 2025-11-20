/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';

import InstanceSummaryCard from '../InstanceSummaryCard.jsx';

const surfaceStyles = {
  glassTile: '',
  glassTileActive: 'active',
  glassTileIdle: 'idle',
  progressTrack: 'track',
  progressIndicator: 'indicator',
};

const statusCodeMeta = [
  { code: '1', label: '1', description: 'Status 1' },
  { code: '2', label: '2', description: 'Status 2' },
];

describe('InstanceSummaryCard', () => {
  it('exibe informações da instância e permite ações', async () => {
    const onSelectInstance = vi.fn();
    const onViewQr = vi.fn();
    const onRequestDelete = vi.fn();
    const user = userEvent.setup();

    render(
      <InstanceSummaryCard
        surfaceStyles={surfaceStyles}
        statusCodeMeta={statusCodeMeta}
        isBusy={false}
        isAuthenticated
        deletingInstanceId={null}
        onSelectInstance={onSelectInstance}
        onViewQr={onViewQr}
        onRequestDelete={onRequestDelete}
        viewModel={{
          key: 'instance-1',
          id: 'instance-1',
          displayName: 'Instância Alpha',
          phoneLabel: '+5511999999999',
          formattedPhone: '(11) 9999-9999',
          addressLabel: 'alpha@whatsapp.net',
          statusInfo: { label: 'Conectado', variant: 'success' },
          metrics: { sent: 10, queued: 3, failed: 1, status: { 1: 5, 2: 5 }, rateUsage: { used: 10, remaining: 90, limit: 100, percentage: 10 } },
          statusValues: { 1: 5, 2: 5 },
          rateUsage: { used: 10, remaining: 90, limit: 100, percentage: 10 },
          ratePercentage: 10,
          lastUpdatedLabel: '01/01/2024 12:00',
          user: 'Operador 1',
          instance: { id: 'instance-1' },
          isCurrent: false,
        }}
      />
    );

    expect(screen.getByText('Conectado')).toBeInTheDocument();
    expect(screen.getByText('Instância Alpha')).toBeInTheDocument();
    expect(screen.getByText(/Instância instance-1/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /detalhes/i }));
    expect(screen.getByText('(11) 9999-9999')).toBeInTheDocument();
    expect(screen.getByText('alpha@whatsapp.net')).toBeInTheDocument();
    expect(screen.getByText(/01\/01\/2024 12:00/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Pausar/i }));
    expect(onSelectInstance).toHaveBeenCalledWith(expect.objectContaining({ id: 'instance-1' }));

    await user.click(screen.getByLabelText('Ações da instância'));
    await user.click(await screen.findByRole('menuitem', { name: /Ver QR em tela cheia/i }));
    expect(onViewQr).toHaveBeenCalledWith(expect.objectContaining({ id: 'instance-1' }));

    await user.click(screen.getByLabelText('Ações da instância'));
    await user.click(await screen.findByRole('menuitem', { name: /Remover instância/i }));
    expect(onRequestDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 'instance-1' }));
  });

  it('diferencia estado de reconexão do estado desconectado', () => {
    render(
      <InstanceSummaryCard
        surfaceStyles={surfaceStyles}
        statusCodeMeta={statusCodeMeta}
        isBusy={false}
        isAuthenticated
        deletingInstanceId={null}
        onSelectInstance={vi.fn()}
        onViewQr={vi.fn()}
        onRequestDelete={vi.fn()}
        viewModel={{
          key: 'instance-2',
          id: 'instance-2',
          displayName: 'Instância Beta',
          phoneLabel: '+551188887777',
          formattedPhone: '(11) 8888-7777',
          addressLabel: 'beta@whatsapp.net',
          statusInfo: { label: 'Reconectando', variant: 'info' },
          metrics: { sent: 0, queued: 0, failed: 0, status: {}, rateUsage: {} },
          statusValues: {},
          rateUsage: {},
          ratePercentage: 0,
          lastUpdatedLabel: 'Ontem',
          user: 'Operador 2',
          instance: { id: 'instance-2' },
          isCurrent: false,
        }}
      />
    );

    expect(screen.getByText('Reconectando')).toBeInTheDocument();
    expect(screen.queryByText('Desconectado')).not.toBeInTheDocument();
  });
});
