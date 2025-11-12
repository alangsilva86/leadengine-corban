/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Suspense } from 'react';

import WhatsAppConnect from '../connect/index';

const onContinueMock = vi.fn();
const onBackMock = vi.fn();
const handleRefreshInstancesMock = vi.fn();

vi.mock('../connect/useWhatsAppConnect', () => ({
  __esModule: true,
  default: vi.fn(() => ({
    surfaceStyles: {
      instancesPanel: 'instances-panel',
      qrInstructionsPanel: 'qr-panel',
      glassTile: 'glass',
      glassTileDashed: 'glass-dashed',
      glassTileActive: 'glass-active',
      glassTileIdle: 'glass-idle',
      destructiveBanner: 'destructive',
      qrIllustration: 'qr-illustration',
      progressTrack: 'progress-track',
      progressIndicator: 'progress-indicator',
    },
    statusCopy: { badge: 'Conectado', description: 'Status' },
    statusTone: 'success',
    countdownMessage: null,
    confirmLabel: 'Continuar',
    confirmDisabled: false,
    qrImageSrc: null,
    isGeneratingQrImage: false,
    qrStatusMessage: 'Pronto',
    hasAgreement: true,
    agreementDisplayName: 'Convênio XPTO',
    selectedAgreement: { id: 'agreement-1' },
    selectedInstance: null,
    selectedInstancePhone: null,
    selectedInstanceStatusInfo: null,
    instancesReady: true,
    hasHiddenInstances: false,
    hasRenderableInstances: true,
    instanceViewModels: [],
    showFilterNotice: false,
    instancesCountLabel: '0 instâncias',
    loadingInstances: false,
    isAuthenticated: true,
    copy: { description: 'Gerencie a conexão do WhatsApp.' },
    localStatus: 'connected',
    onBack: onBackMock,
    onContinue: onContinueMock,
    handleRefreshInstances: handleRefreshInstancesMock,
    handleCreateInstance: vi.fn(),
    submitCreateInstance: vi.fn(),
    campaign: null,
    setShowAllInstances: vi.fn(),
    setQrPanelOpen: vi.fn(),
    setQrDialogOpen: vi.fn(),
    pairingPhoneInput: '',
    pairingPhoneError: null,
    requestingPairingCode: false,
    handlePairingPhoneChange: vi.fn(),
    handleRequestPairingCode: vi.fn(),
    timelineItems: [],
    realtimeConnected: false,
    handleInstanceSelect: vi.fn(),
    handleViewQr: vi.fn(),
    handleGenerateQr: vi.fn(),
    handleMarkConnected: vi.fn(),
    handleDeleteInstance: vi.fn(),
    deletionDialog: { open: false },
    setInstancePendingDelete: vi.fn(),
    isBusy: false,
    canContinue: true,
    qrPanelOpen: false,
    isQrDialogOpen: false,
    hasCampaign: false,
    statusCodeMeta: [],
    defaultInstanceName: 'Nova instância',
    deletingInstanceId: null,
    errorState: null,
    loadInstances: vi.fn(),
    showAllInstances: false,
    handleRetry: vi.fn(),
    setCreateInstanceOpen: vi.fn(),
    isCreateInstanceOpen: false,
    nextStage: 'Campanhas',
    stepLabel: 'Passo 2 de 5',
    onboardingDescription: 'Conecte seu canal oficial.',
    renderInstances: [],
  })),
}));

vi.mock('../components/InstancesPanel.jsx', () => ({
  __esModule: true,
  default: (props) => (
    <div data-testid="instances-panel">
      <button type="button" onClick={props.onRefresh}>
        Atualizar instâncias
      </button>
    </div>
  ),
}));

vi.mock('../components/CreateInstanceDialog.jsx', () => ({
  __esModule: true,
  default: ({ open }) => (open ? <div data-testid="create-instance-dialog">Criar instância</div> : null),
}));

vi.mock('../components/QrPreview.jsx', () => ({
  __esModule: true,
  default: () => <div data-testid="qr-preview">QR Preview</div>,
}));

vi.mock('../connect/QrFlow', () => ({
  __esModule: true,
  default: () => <div data-testid="qr-flow">QR Flow</div>,
}));

describe('WhatsAppConnect', () => {
  beforeEach(() => {
    onContinueMock.mockClear();
    onBackMock.mockClear();
    handleRefreshInstancesMock.mockClear();
  });

  it('renders the instances overview and triggers actions', async () => {
    render(
      <Suspense fallback={<span>loading</span>}>
        <WhatsAppConnect />
      </Suspense>
    );

    expect(await screen.findByText('Conecte seu WhatsApp')).toBeInTheDocument();
    expect(screen.getByTestId('instances-panel')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Continuar'));
    expect(onContinueMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Atualizar instâncias'));
    expect(handleRefreshInstancesMock).toHaveBeenCalledTimes(1);

    expect(screen.queryByText('Campanhas e roteamento')).not.toBeInTheDocument();
  });
});
