/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const useWhatsAppInstancesMock = vi.fn();

vi.mock('../hooks/useWhatsAppInstances.js', () => ({
  default: (...args) => useWhatsAppInstancesMock(...args),
}), { virtual: true });

const useWhatsAppCampaignsMock = vi.fn(() => ({
  campaign: null,
  campaigns: [],
  campaignsLoading: false,
  campaignError: null,
  campaignAction: null,
  persistentWarning: null,
  loadCampaigns: vi.fn(),
  createCampaign: vi.fn(),
  updateCampaignStatus: vi.fn(),
  deleteCampaign: vi.fn(),
  reassignCampaign: vi.fn(),
  fetchCampaignImpact: vi.fn(),
  clearCampaignSelection: vi.fn(),
}));

vi.mock('../hooks/useWhatsAppCampaigns.js', () => ({
  default: (...args) => useWhatsAppCampaignsMock(...args),
import { cloneElement, isValidElement } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

const {
  mockApiGet,
  mockApiPost,
  mockApiPatch,
  mockApiDelete,
  mockGetAuthToken,
  mockUseInstanceLiveUpdates,
  toastSpies,
  createInstanceDialogMock,
  buttonMock,
} = vi.hoisted(() => {
  const mockApiGetFn = vi.fn();
  const mockApiPostFn = vi.fn();
  const mockApiPatchFn = vi.fn();
  const mockApiDeleteFn = vi.fn();
  const mockTokenFn = vi.fn(() => null);
  const mockRealtimeHook = vi.fn(() => ({ connected: false }));
  const toast = {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  };

  const dialogMock = vi.fn(({ open, onOpenChange, onSubmit }) => {
    if (!open) {
      return null;
    }

    const handleSubmit = async () => {
      await onSubmit?.({ name: 'WhatsApp Vendas', id: 'WhatsApp Vendas' });
      onOpenChange?.(false);
    };

    return (
      <div>
        <button type="button" onClick={handleSubmit}>
          confirmar criação
        </button>
      </div>
    );
  });

  const button = ({ asChild, children, ...props }) => {
    if (asChild && isValidElement(children)) {
      return cloneElement(children, props);
    }
    return (
      <button type="button" {...props}>
        {children}
      </button>
    );
  };

  return {
    mockApiGet: mockApiGetFn,
    mockApiPost: mockApiPostFn,
    mockApiPatch: mockApiPatchFn,
    mockApiDelete: mockApiDeleteFn,
    mockGetAuthToken: mockTokenFn,
    mockUseInstanceLiveUpdates: mockRealtimeHook,
    toastSpies: toast,
    createInstanceDialogMock: dialogMock,
    buttonMock: button,
  };
});

vi.mock('@/lib/api.js', () => ({
  apiGet: (...args) => mockApiGet(...args),
  apiPost: (...args) => mockApiPost(...args),
  apiPatch: (...args) => mockApiPatch(...args),
  apiDelete: (...args) => mockApiDelete(...args),
}));

vi.mock('@/lib/auth.js', () => ({
  getAuthToken: (...args) => mockGetAuthToken(...args),
}));

vi.mock('@/lib/session-storage.js', () => ({
  default: () => false,
}));

vi.mock('qrcode', () => ({
  toDataURL: vi.fn(() => Promise.resolve('data:image/png;base64,ZmFrZQ==')),
}));

vi.mock('sonner', () => ({
  toast: toastSpies,
}));

vi.mock('../shared/usePlayfulLogger.js', () => ({
  default: () => ({
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('./hooks/useInstanceLiveUpdates.js', () => ({
  default: (...args) => mockUseInstanceLiveUpdates(...args),
}));

vi.mock('../onboarding/useOnboardingStepLabel.js', () => ({
  default: () => ({ stepLabel: 'Passo 3', nextStage: 'Inbox de Leads' }),
vi.mock('@/components/ui/notice-banner.jsx', () => ({
  default: () => null,
}));

vi.mock('../components/CampaignsPanel.jsx', () => ({
  default: () => null,
}));

vi.mock('../components/CreateCampaignDialog.jsx', () => ({
  default: () => null,
}));

vi.mock('../components/ReassignCampaignDialog.jsx', () => ({
  default: () => null,
}));

vi.mock('../components/CampaignHistoryDialog.jsx', () => ({
  default: () => null,
}));

vi.mock('../components/QrPreview.jsx', () => ({
  default: () => (
    <div data-testid="qr-preview">
      <img alt="QR Code do WhatsApp" src="data:image/png;base64,mock" />
    </div>
  ),
}));

vi.mock('../components/CreateInstanceDialog.jsx', () => ({
  default: (...args) => createInstanceDialogMock(...args),
}));

const passthrough = (Tag = 'div') => ({ asChild, children, ...props }) => {
  if (asChild && isValidElement(children)) {
    return cloneElement(children, props);
  }
  const Component = Tag;
  return <Component {...props}>{children}</Component>;
};

vi.mock('@/components/ui/badge.jsx', () => ({ Badge: passthrough('span') }));
vi.mock('@/components/ui/button.jsx', () => ({ Button: (...args) => buttonMock(...args) }));
vi.mock('@/components/ui/card.jsx', () => ({
  Card: passthrough('section'),
  CardHeader: passthrough('div'),
  CardTitle: passthrough('h2'),
  CardDescription: passthrough('p'),
  CardContent: passthrough('div'),
  CardFooter: passthrough('div'),
}));
vi.mock('@/components/ui/dialog.jsx', () => ({
  Dialog: passthrough('div'),
  DialogContent: passthrough('div'),
  DialogHeader: passthrough('div'),
  DialogTitle: passthrough('div'),
  DialogDescription: passthrough('div'),
}));
vi.mock('@/components/ui/alert-dialog.jsx', () => ({
  AlertDialog: passthrough('div'),
  AlertDialogContent: passthrough('div'),
  AlertDialogHeader: passthrough('div'),
  AlertDialogTitle: passthrough('div'),
  AlertDialogDescription: passthrough('div'),
  AlertDialogFooter: passthrough('div'),
  AlertDialogAction: passthrough('button'),
  AlertDialogCancel: passthrough('button'),
}));
vi.mock('@/components/ui/collapsible.jsx', () => ({
  Collapsible: passthrough('div'),
  CollapsibleContent: passthrough('div'),
  CollapsibleTrigger: passthrough('button'),
}));
vi.mock('@/components/ui/separator.jsx', () => ({ Separator: () => <hr /> }));
vi.mock('@/components/ui/input.jsx', () => ({ Input: passthrough('input') }));
vi.mock('@/components/ui/skeleton.jsx', () => ({
  Skeleton: ({ className }) => <div data-testid="skeleton" className={className} />,
}));

vi.mock('lucide-react', () => ({
  QrCode: () => <span>QR</span>,
  CheckCircle2: () => <span>Check</span>,
  Link2: () => <span>Link</span>,
  ArrowLeft: () => <span>Back</span>,
  RefreshCcw: () => <span>Refresh</span>,
  Clock: () => <span>Clock</span>,
  AlertCircle: () => <span>Alert</span>,
  Loader2: () => <span>Loader</span>,
  Trash2: () => <span>Trash</span>,
  ChevronDown: () => <span>Chevron</span>,
  History: () => <span>History</span>,
  AlertTriangle: () => <span>Triangle</span>,
}));

const InstancesPanelMock = vi.fn(() => null);
vi.mock('../components/InstancesPanel.jsx', () => ({
  default: (props) => {
    InstancesPanelMock(props);
    return null;
  },
}));
const renderComponent = async (props = {}) => {
  const defaultProps = {
    selectedAgreement: { id: 'agreement-1', name: 'Convênio', tenantId: 'tenant-123' },
    status: 'disconnected',
    onStatusChange: vi.fn(),
  };

  const userProps = { ...defaultProps, ...props };

  const Component = (await import('../WhatsAppConnect.jsx')).default;

  return render(<Component {...userProps} />);
};

beforeEach(() => {
  mockApiGet.mockReset();
  mockApiPost.mockReset();
  mockApiPatch.mockReset();
  mockApiDelete.mockReset();
  mockGetAuthToken.mockReset();
  mockGetAuthToken.mockReturnValue(null);
  mockUseInstanceLiveUpdates.mockReset();
  mockUseInstanceLiveUpdates.mockReturnValue({ connected: false });
  createInstanceDialogMock.mockClear();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('WhatsAppConnect', () => {
  it('renders existing instances on first load', async () => {
    mockApiGet.mockImplementation((url) => {
      if (url.startsWith('/api/integrations/whatsapp/instances')) {
        return Promise.resolve({
          data: {
            instances: [
              { id: 'inst-1', name: 'Instância Demo', status: 'connected', connected: true },
            ],
          },
        });
      }
      if (url.startsWith('/api/campaigns')) {
        return Promise.resolve({ items: [] });
      }
      return Promise.resolve({});
    });

    await renderComponent();

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith(
        expect.stringContaining('/api/integrations/whatsapp/instances?refresh=1')
      );
      expect(mockApiGet).toHaveBeenCalledWith('/api/integrations/whatsapp/instances?refresh=1');
    });

    const instanceLabels = await screen.findAllByText('Instância Demo');
    expect(instanceLabels.length).toBeGreaterThan(0);
  });

  it('fetches campaigns globalmente sem aplicar o convênio por padrão', async () => {
    const capturedCalls = [];

    mockApiGet.mockImplementation((url) => {
      capturedCalls.push(url);
      if (url.startsWith('/api/integrations/whatsapp/instances')) {
        return Promise.resolve({ data: { instances: [] } });
      }
      if (url.startsWith('/api/campaigns')) {
        return Promise.resolve({
          items: [
            {
              id: 'camp-1',
              agreementId: 'agreement-2',
              agreementName: 'Convênio 2',
              name: 'Campanha 1',
              status: 'active',
              instanceId: null,
              updatedAt: new Date().toISOString(),
              metrics: {},
            },
          ],
        });
      }
      return Promise.resolve({});
    });

    await renderComponent();

    await waitFor(() => {
      expect(
        capturedCalls.some((entry) => {
          const url = new URL(entry, 'https://example.test');
          return (
            url.pathname === '/api/campaigns' &&
            url.searchParams.get('status') === 'active,paused,draft,ended'
          );
        })
      ).toBe(true);
    });

    const globalCall = capturedCalls
      .map((entry) => new URL(entry, 'https://example.test'))
      .find(
        (url) =>
          url.pathname === '/api/campaigns' &&
          url.searchParams.get('status') === 'active,paused,draft,ended'
      );
    expect(globalCall).toBeDefined();
    expect(globalCall?.searchParams.has('agreementId')).toBe(false);

    const campaignCalls = capturedCalls.filter((entry) =>
      entry.startsWith('/api/campaigns')
    );
    expect(campaignCalls).toHaveLength(1);
  });

  it('hides disconnected broker sessions by default but allows showing all', async () => {
    const user = userEvent.setup();
    mockApiGet.mockImplementation((url) => {
      if (url.startsWith('/api/integrations/whatsapp/instances')) {
        return Promise.resolve({
          data: {
            instances: [
              {
                id: 'inst-1',
                name: 'Instância Ativa',
                status: 'connected',
                connected: true,
              },
              {
                id: '5511999999999@whatsapp.net',
                name: 'WhatsApp Broker Desconectado',
                status: 'disconnected',
                connected: false,
                source: 'broker',
              },
            ],
          },
        });
      }
      if (url.startsWith('/api/campaigns')) {
        return Promise.resolve({ items: [] });
      }
      return Promise.resolve({});
    });

    await renderComponent();

    expect(screen.queryByText('WhatsApp Broker Desconectado')).not.toBeInTheDocument();

    const showAllButton = await screen.findByRole('button', { name: /mostrar todas/i });
    await user.click(showAllButton);

    const brokerInstance = await screen.findAllByText('WhatsApp Broker Desconectado');
    expect(brokerInstance.length).toBeGreaterThan(0);
    expect(await screen.findByRole('button', { name: /ocultar desconectadas/i })).toBeInTheDocument();
  });

  it('keeps connecting sessions visible even when not fully connected', async () => {
    mockApiGet.mockImplementation((url) => {
      if (url.startsWith('/api/integrations/whatsapp/instances')) {
        return Promise.resolve({
          data: {
            instances: [
              { id: 'inst-2', name: 'Instância em Provisionamento', status: 'connecting', connected: false },
            ],
          },
        });
      }
      if (url.startsWith('/api/campaigns')) {
        return Promise.resolve({ items: [] });
      }
      return Promise.resolve({});
    });

    await renderComponent();

    const connectingInstance = await screen.findAllByText('Instância em Provisionamento');
    expect(connectingInstance.length).toBeGreaterThan(0);
  });

  it('creates an instance and keeps the friendly name', async () => {
    const instancesQueue = [
      { data: { instances: [] } },
      {
        data: {
          instances: [
            {
              id: 'WhatsApp Vendas',
              name: 'WhatsApp Vendas',
              status: 'connecting',
              connected: false,
            },
          ],
        },
      },
    ];

    mockApiGet.mockImplementation((url) => {
      if (url.startsWith('/api/integrations/whatsapp/instances')) {
        const response = instancesQueue.shift() ?? instancesQueue[0];
        return Promise.resolve(response);
      }
      if (url.includes('/status')) {
        return Promise.resolve({ data: { status: 'connecting', instanceId: 'WhatsApp Vendas' } });
      }
      if (url.startsWith('/api/campaigns')) {
        return Promise.resolve({ items: [] });
      }
      return Promise.resolve({});
    });

    mockApiPost.mockImplementation((url) => {
      if (url === '/api/integrations/whatsapp/instances') {
        return Promise.resolve({
          data: { id: 'WhatsApp Vendas', status: 'connecting', connected: false },
        });
      }
      return Promise.resolve({});
    });

const CampaignsPanelMock = vi.fn(() => null);
vi.mock('../components/CampaignsPanel.jsx', () => ({
  default: (props) => {
    CampaignsPanelMock(props);
    return null;
  },
}));

const QrSectionMock = vi.fn(() => null);
vi.mock('../components/QrSection.jsx', () => ({
  default: (props) => {
    QrSectionMock(props);
    return null;
  },
}));

vi.mock('../components/CreateInstanceDialog.jsx', () => ({
  default: passthrough('div'),
}));

vi.mock('../components/CreateCampaignDialog.jsx', () => ({
  default: passthrough('div'),
}));

vi.mock('../components/ReassignCampaignDialog.jsx', () => ({
  default: passthrough('div'),
}));

vi.mock('../components/CampaignHistoryDialog.jsx', () => ({
  default: () => <div data-testid="campaign-history" />,
}));

vi.mock('@/components/ui/notice-banner.jsx', () => ({
  default: ({ children }) => <div data-testid="notice-banner">{children}</div>,
}));

const createHookState = (overrides = {}) => {
  const baseInstancesPanelProps = {
    surfaceStyles: { panel: 'styles' },
    hasAgreement: true,
    nextStage: 'Inbox de Leads',
    agreementDisplayName: 'Convênio',
    selectedAgreementRegion: 'SP',
    selectedAgreementId: 'agreement-1',
    selectedInstance: { id: 'instance-1', name: 'Instância 1', status: 'connecting' },
    selectedInstanceStatusInfo: { label: 'Conectando', variant: 'info' },
    selectedInstancePhone: '+5511999999999',
    hasCampaign: false,
    campaign: null,
    instancesReady: true,
    hasHiddenInstances: false,
    hasRenderableInstances: true,
    renderInstances: [{ id: 'instance-1', name: 'Instância 1' }],
    showFilterNotice: false,
    showAllInstances: false,
    instancesCountLabel: '1 de 1',
    errorState: null,
    isBusy: false,
    isAuthenticated: true,
    loadingInstances: false,
    copy: { badge: 'Pendente', description: 'Leia o QR Code no WhatsApp Web.' },
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
    statusCodeMeta: [],
    getStatusInfo: vi.fn(),
    getInstanceMetrics: vi.fn(),
    formatMetricValue: vi.fn(),
    resolveInstancePhone: vi.fn(),
    formatPhoneNumber: vi.fn(),
  };

  const baseQrSectionProps = {
    surfaceStyles: { qr: 'styles' },
    open: true,
    onOpenChange: vi.fn(),
    qrImageSrc: 'data:image/png;base64,ZmFrZQ==',
    isGeneratingQrImage: false,
    qrStatusMessage: 'Pronto para leitura',
    onGenerate: vi.fn(),
    onOpenQrDialog: vi.fn(),
    generateDisabled: false,
    openDisabled: false,
    pairingPhoneInput: '',
    onPairingPhoneChange: vi.fn(),
    pairingDisabled: false,
    requestingPairingCode: false,
    onRequestPairingCode: vi.fn(),
    pairingPhoneError: null,
    timelineItems: [],
    realtimeConnected: false,
    humanizeLabel: vi.fn(),
    formatPhoneNumber: vi.fn(),
    formatTimestampLabel: vi.fn(),
  };

  const baseCampaignsPanelProps = {
    agreementName: 'Convênio',
    campaigns: [],
    loading: false,
    error: null,
    onRefresh: vi.fn(),
    onCreateClick: vi.fn(),
    onPause: vi.fn(),
    onActivate: vi.fn(),
    onDelete: vi.fn(),
    onReassign: vi.fn(),
    onDisconnect: vi.fn(),
    actionState: null,
    selectedInstanceId: 'instance-1',
    canCreateCampaigns: true,
    selectedAgreementId: 'agreement-1',
  };

  const baseDialogs = {
    createInstance: {
      open: false,
      onOpenChange: vi.fn(),
      defaultName: 'Instância WhatsApp',
      onSubmit: vi.fn(),
    },
    createCampaign: {
      open: false,
      onOpenChange: vi.fn(),
      agreement: { id: 'agreement-1', name: 'Convênio' },
      instances: [],
      defaultInstanceId: 'instance-1',
      onSubmit: vi.fn(),
    },
    reassignCampaign: {
      open: false,
      campaign: null,
      intent: 'reassign',
      instances: [],
      onClose: vi.fn(),
      onSubmit: vi.fn(),
      fetchImpact: vi.fn(),
    },
    removal: {
      open: false,
      title: 'Remover instância',
      description: 'Descrição de remoção',
      actionLabel: 'Remover',
      onConfirm: vi.fn(),
      onCancel: vi.fn(),
    },
    qr: {
      open: false,
      onOpenChange: vi.fn(),
      previewProps: { src: 'data:image/png;base64,ZmFrZQ==', isGenerating: false },
    },
  };

  return {
    header: {
      stepLabel: 'Passo 3',
      nextStage: 'Inbox de Leads',
      statusTone: 'warning',
      copy: { badge: 'Pendente', description: 'Leia o QR Code no WhatsApp Web.' },
      onboardingDescription: 'Escaneie o QR Code para ativar a sessão.',
      countdownMessage: null,
      agreementDisplayName: 'Convênio',
      hasAgreement: true,
    },
    persistentWarning: null,
    errorNotice: null,
    campaignsPanelProps: baseCampaignsPanelProps,
    instancesPanelProps: baseInstancesPanelProps,
    qrSectionProps: baseQrSectionProps,
    dialogs: baseDialogs,
    ...overrides,
  };
};

const defaultProps = {
  selectedAgreement: { id: 'agreement-1', name: 'Convênio', tenantId: 'tenant-123' },
  status: 'disconnected',
  activeCampaign: null,
  onboarding: { stages: [] },
  onStatusChange: vi.fn(),
  onCampaignReady: vi.fn(),
  onContinue: vi.fn(),
  onBack: vi.fn(),
};

const renderComponent = async ({ hookState, props } = {}) => {
  const state = hookState ?? createHookState();
  useWhatsAppInstancesMock.mockReturnValue(state);
  const Component = (await import('../WhatsAppConnect.jsx')).default;
  return render(<Component {...defaultProps} {...props} />);
};

describe('WhatsAppConnect (hook integration)', () => {
  beforeEach(() => {
    vi.resetModules();
    cleanup();
    InstancesPanelMock.mockReset();
    QrSectionMock.mockReset();
    CampaignsPanelMock.mockReset();
    useWhatsAppInstancesMock.mockReset();
    defaultProps.onStatusChange.mockReset();
    defaultProps.onCampaignReady.mockReset();
    defaultProps.onContinue.mockReset();
  });

  it('forwards hook-provided props to layout panels', async () => {
    const hookState = createHookState();

    await renderComponent({ hookState });

    expect(useWhatsAppInstancesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedAgreement: defaultProps.selectedAgreement,
        status: defaultProps.status,
        activeCampaign: defaultProps.activeCampaign,
        onboarding: defaultProps.onboarding,
        onStatusChange: defaultProps.onStatusChange,
        onCampaignReady: defaultProps.onCampaignReady,
        onContinue: defaultProps.onContinue,
      })
    );

    expect(InstancesPanelMock).toHaveBeenCalledTimes(1);
    expect(InstancesPanelMock.mock.calls[0][0]).toMatchObject(hookState.instancesPanelProps);

    expect(QrSectionMock).toHaveBeenCalledTimes(1);
    expect(QrSectionMock.mock.calls[0][0]).toMatchObject(hookState.qrSectionProps);

    expect(CampaignsPanelMock).toHaveBeenCalledTimes(1);
    expect(CampaignsPanelMock.mock.calls[0][0]).toMatchObject(hookState.campaignsPanelProps);
  });

  it('invokes lifecycle callbacks through InstancesPanel interactions', async () => {
    const hookState = createHookState();

    hookState.instancesPanelProps.onSelectInstance = (instance) => {
      defaultProps.onStatusChange(instance.status);
      defaultProps.onCampaignReady(instance);
    };
    hookState.instancesPanelProps.onConfirm = () => {
      defaultProps.onContinue();
    };
    hookState.instancesPanelProps.onMarkConnected = () => {
      defaultProps.onStatusChange('connected');
    };

    await renderComponent({ hookState });

    const panelProps = InstancesPanelMock.mock.calls[0][0];

    const nextInstance = { id: 'instance-2', status: 'connecting' };
    panelProps.onSelectInstance(nextInstance);

    expect(defaultProps.onStatusChange).toHaveBeenCalledWith('connecting');
    expect(defaultProps.onCampaignReady).toHaveBeenCalledWith(nextInstance);

    panelProps.onMarkConnected();
    expect(defaultProps.onStatusChange).toHaveBeenCalledWith('connected');

    panelProps.onConfirm();
    expect(defaultProps.onContinue).toHaveBeenCalledTimes(1);
  });

  it('wires QR actions and keeps warning/error messages visible', async () => {
    const hookState = createHookState({
      persistentWarning: 'Verifique o sinal do WhatsApp antes de continuar.',
      errorNotice: { title: 'Falha ao carregar', message: 'Não foi possível carregar instâncias.' },
    });

    const generateSpy = vi.fn();
    hookState.qrSectionProps.onGenerate = generateSpy;
    hookState.instancesPanelProps.errorState = {
      title: 'Falha ao carregar',
      message: 'Não foi possível carregar instâncias.',
    };

    await renderComponent({ hookState });

    const qrProps = QrSectionMock.mock.calls[0][0];
    qrProps.onGenerate();

    expect(generateSpy).toHaveBeenCalledTimes(1);

    expect(screen.getByTestId('notice-banner')).toHaveTextContent(
      'Verifique o sinal do WhatsApp antes de continuar.'
    );

    expect(InstancesPanelMock.mock.calls[0][0].errorState).toEqual(
      hookState.instancesPanelProps.errorState
    );
  });
});
