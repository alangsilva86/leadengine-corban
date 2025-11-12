/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import InstancesPanel from '../InstancesPanel.jsx';

const surfaceStyles = {
  instancesPanel: '',
  glassTile: '',
  glassTileDashed: '',
  glassTileActive: 'active',
  glassTileIdle: 'idle',
  progressTrack: 'track',
  progressIndicator: 'indicator',
};

const statusCodeMeta = [
  { code: '1', label: '1', description: 'Status 1' },
  { code: '2', label: '2', description: 'Status 2' },
];

const buildViewModel = (overrides = {}) => ({
  key: overrides.key ?? 'instance-1',
  id: overrides.id ?? 'instance-1',
  displayName: overrides.displayName ?? 'Instância Alpha',
  phoneLabel: overrides.phoneLabel ?? '+5511999999999',
  formattedPhone: overrides.formattedPhone ?? '(11) 9999-9999',
  addressLabel: overrides.addressLabel ?? 'alpha@whatsapp.net',
  statusInfo: overrides.statusInfo ?? { label: 'Ativo', variant: 'success' },
  metrics:
    overrides.metrics ??
    ({ sent: 10, queued: 2, failed: 1, status: { 1: 5, 2: 5 }, rateUsage: { used: 50, remaining: 50, limit: 100, percentage: 50 } }),
  statusValues: overrides.statusValues ?? { 1: 5, 2: 5 },
  rateUsage:
    overrides.rateUsage ?? { used: 50, remaining: 50, limit: 100, percentage: 50 },
  ratePercentage: overrides.ratePercentage ?? 50,
  lastUpdatedLabel: overrides.lastUpdatedLabel ?? '01/01/2024 10:00',
  user: overrides.user ?? 'Operador 1',
  instance: overrides.instance ?? { id: 'instance-1' },
  isCurrent: overrides.isCurrent ?? false,
});

describe('InstancesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseProps = {
    surfaceStyles,
    hasAgreement: true,
    nextStage: 'Inbox',
    agreementDisplayName: 'Convênio A',
    selectedAgreementRegion: 'São Paulo',
    selectedAgreementId: 'agreement-1',
    selectedInstance: { id: 'instance-2', name: 'Instância Beta' },
    selectedInstanceStatusInfo: { label: 'Conectado', variant: 'success' },
    selectedInstancePhone: '+5511988887777',
    hasCampaign: false,
    campaign: null,
    instancesReady: true,
    hasHiddenInstances: false,
    hasRenderableInstances: true,
    instanceViewModels: [buildViewModel()],
    showFilterNotice: false,
    showAllInstances: false,
    instancesCountLabel: '1 instância',
    errorState: null,
    isBusy: false,
    isAuthenticated: true,
    loadingInstances: false,
    copy: { badge: 'Pendente', description: 'Descrição do status' },
    localStatus: 'disconnected',
    confirmLabel: 'Confirmar',
    confirmDisabled: false,
    onConfirm: vi.fn(),
    onMarkConnected: vi.fn(),
    onRefresh: vi.fn(),
    onCreateInstance: vi.fn(),
    onToggleShowAll: vi.fn(),
    onShowAll: vi.fn(),
    onRetry: vi.fn(),
    onSelectInstance: vi.fn(),
    onViewQr: vi.fn(),
    onRequestDelete: vi.fn(),
    deletingInstanceId: null,
    statusCodeMeta,
  };

  it('renderiza instâncias disponíveis com resumo operacional e ação principal', async () => {
    const user = userEvent.setup();
    render(<InstancesPanel {...baseProps} />);

    expect(screen.getByText('Instância Alpha')).toBeInTheDocument();
    expect(screen.getByText(/Instâncias: 1 ativas/i)).toBeInTheDocument();
    expect(screen.getByText(/Fila total:/i)).toBeInTheDocument();
    expect(screen.getByText(/Utilização do limite 50%/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Manter saudável/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Manter saudável/i }));
    expect(baseProps.onSelectInstance).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'instance-1' }),
      expect.objectContaining({ skipAutoQr: true }),
    );
  });

  it('exibe estado vazio quando não há instâncias renderizáveis mas existem ocultas', async () => {
    const user = userEvent.setup();
    render(
      <InstancesPanel
        {...baseProps}
        instancesReady
        hasRenderableInstances={false}
        hasHiddenInstances
        instanceViewModels={[]}
      />
    );

    const emptyMessage = screen.getByText(/Nenhuma instância conectada no momento/i);
    expect(emptyMessage).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mostrar todas/i })).toBeInTheDocument();

    const showAllButton = screen.getByRole('button', { name: /Mostrar todas/i });
    await user.click(showAllButton);
    expect(baseProps.onShowAll).toHaveBeenCalled();
  });

  it('exibe estado de erro com ação de tentar novamente', async () => {
    const user = userEvent.setup();
    render(
      <InstancesPanel
        {...baseProps}
        errorState={{ title: 'Erro', message: 'Algo deu errado' }}
      />
    );

    expect(screen.getByText('Erro')).toBeInTheDocument();
    expect(screen.getByText('Algo deu errado')).toBeInTheDocument();

    const retryButton = screen.getByRole('button', { name: /Tentar novamente/i });
    await user.click(retryButton);
    expect(baseProps.onRetry).toHaveBeenCalled();
  });
});
