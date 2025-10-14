/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
const mockApiPatch = vi.fn();
const mockApiDelete = vi.fn();
const mockGetAuthToken = vi.fn(() => null);

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

vi.mock('@/lib/auth.js', () => ({
  getAuthToken: () => 'test-token',
}));

vi.mock('qrcode', () => ({
  toDataURL: vi.fn(() => Promise.resolve('data:image/png;base64,ZmFrZQ==')),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('../shared/usePlayfulLogger.js', () => ({
  default: () => ({
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('./hooks/useInstanceLiveUpdates.js', () => ({
  default: () => ({ connected: false }),
}));

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

vi.mock('../components/CreateInstanceDialog.jsx', () => ({
  default: ({ open, onOpenChange, onSubmit }) => {
    if (!open) {
      return null;
    }

    const handleSubmit = async () => {
      await onSubmit?.({ name: 'WhatsApp Vendas', id: 'whatsapp-vendas' });
      onOpenChange?.(false);
    };

    return (
      <div>
        <button type="button" onClick={handleSubmit}>
          confirmar criação
        </button>
      </div>
    );
  },
}));

const passthrough = (Tag = 'div') => ({ children, ...props }) => (
  <Tag {...props}>{children}</Tag>
);

vi.mock('@/components/ui/badge.jsx', () => ({ Badge: passthrough('span') }));
vi.mock('@/components/ui/button.jsx', () => ({ Button: passthrough('button') }));
vi.mock('@/components/ui/card.jsx', () => ({
  Card: passthrough('section'),
  CardHeader: passthrough('div'),
  CardTitle: passthrough('h2'),
  CardDescription: passthrough('p'),
  CardContent: passthrough('div'),
  CardFooter: passthrough('div'),
}));
vi.mock('@/components/ui/input.jsx', () => ({ Input: passthrough('input') }));
vi.mock('@/components/ui/separator.jsx', () => ({ Separator: () => <hr /> }));
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
        capturedCalls.some((entry) =>
          entry.includes('/api/campaigns?status=active,paused,draft,ended')
        )
      ).toBe(true);
    });

    const globalCall = capturedCalls.find((entry) =>
      entry.includes('/api/campaigns?status=active,paused,draft,ended')
    );
    expect(globalCall).toBeDefined();
    expect(globalCall).not.toContain('agreementId=');
  });

  it('hides disconnected broker sessions by default but allows showing all', async () => {
    mockApiGet.mockImplementation((url) => {
      if (url.startsWith('/api/integrations/whatsapp/instances')) {
        return Promise.resolve({
          data: {
            instances: [
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

    const showAllButtons = await screen.findAllByRole('button', { name: /mostrar todas/i });
    await userEvent.setup().click(showAllButtons[showAllButtons.length - 1]);

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
              id: 'whatsapp-vendas',
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
        return Promise.resolve({ data: { status: 'connecting', instanceId: 'whatsapp-vendas' } });
      }
      if (url.startsWith('/api/campaigns')) {
        return Promise.resolve({ items: [] });
      }
      return Promise.resolve({});
    });

    mockApiPost.mockImplementation((url) => {
      if (url === '/api/integrations/whatsapp/instances') {
        return Promise.resolve({
          data: { id: 'whatsapp-vendas', status: 'connecting', connected: false },
        });
      }
      return Promise.resolve({});
    });

    await renderComponent();

    const addButtons = await screen.findAllByRole('button', { name: /nova instância/i });
    const addButton = addButtons[0];
    await userEvent.setup().click(addButton);

    const confirmButtons = await screen.findAllByRole('button', { name: /confirmar criação/i });
    expect(confirmButtons.length).toBeGreaterThan(0);
    await userEvent.setup().click(confirmButtons[0]);

    const createdInstanceLabels = await screen.findAllByText('WhatsApp Vendas');
    expect(createdInstanceLabels.length).toBeGreaterThan(0);
  });

  it('allows creating an instance without a selected agreement', async () => {
    const instancesQueue = [
      { data: { instances: [] } },
      {
        data: {
          instances: [
            {
              id: 'whatsapp-vendas',
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
        return Promise.resolve({ data: { status: 'connecting', instanceId: 'whatsapp-vendas' } });
      }
      if (url.startsWith('/api/campaigns')) {
        return Promise.resolve({ items: [] });
      }
      return Promise.resolve({});
    });

    mockApiPost.mockImplementation((url) => {
      if (url === '/api/integrations/whatsapp/instances') {
        return Promise.resolve({
          data: { id: 'whatsapp-vendas', status: 'connecting', connected: false },
        });
      }
      return Promise.resolve({});
    });

    const view = await renderComponent({ selectedAgreement: null });
    const scoped = within(view.container);

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/api/integrations/whatsapp/instances?refresh=1');
    });

    const agreementLabels = await scoped.findAllByText(/Nenhum convênio selecionado/i);
    expect(agreementLabels.length).toBeGreaterThan(0);

    await waitFor(() => {
      const candidates = scoped.getAllByRole('button', { name: /nova instância/i });
      expect(candidates.some((button) => !button.hasAttribute('disabled'))).toBe(true);
    });

    const addButtons = scoped.getAllByRole('button', { name: /nova instância/i });
    const addButton = addButtons.find((button) => !button.hasAttribute('disabled'));
    expect(addButton).toBeDefined();
    await userEvent.setup().click(addButton);

    const confirmButtons = await scoped.findAllByRole('button', { name: /confirmar criação/i });
    expect(confirmButtons.length).toBeGreaterThan(0);
    await userEvent.setup().click(confirmButtons[0]);

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        '/api/integrations/whatsapp/instances',
        expect.objectContaining({ name: 'WhatsApp Vendas' })
      );
    });

    const payload = mockApiPost.mock.calls.find(
      ([endpoint]) => endpoint === '/api/integrations/whatsapp/instances'
    )?.[1];
    expect(payload).toBeDefined();
    expect(payload).not.toHaveProperty('agreementId');
    expect(payload).not.toHaveProperty('tenantId');

    const createdInstanceLabels = await screen.findAllByText('WhatsApp Vendas');
    expect(createdInstanceLabels.length).toBeGreaterThan(0);
  });

  it('shows the QR code and updates status when pairing is requested', async () => {
    mockApiGet.mockImplementation((url) => {
      if (url.includes('/status')) {
        return Promise.resolve({
          data: {
            status: 'qr_required',
            qr: { qrCode: 'BAYL0RS:12345', expiresAt: new Date(Date.now() + 60000).toISOString() },
            instance: {
              id: 'whatsapp-vendas',
              status: 'qr_required',
              connected: false,
            },
          },
        });
      }
      if (url.includes('/qr')) {
        return Promise.resolve({
          data: {
            qr: {
              qrCode: 'BAYL0RS:12345',
              expiresAt: new Date(Date.now() + 60000).toISOString(),
            },
          },
        });
      }
      if (url.startsWith('/api/integrations/whatsapp/instances')) {
        return Promise.resolve({
          data: {
            instances: [
              {
                id: 'whatsapp-vendas',
                name: 'WhatsApp Vendas',
                status: 'disconnected',
                connected: false,
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

    const showAllButton = await screen.findByRole('button', { name: /mostrar todas/i });
    await userEvent.setup().click(showAllButton);

    const qrButtons = await screen.findAllByRole('button', { name: /ver qr/i });
    await userEvent.setup().click(qrButtons[0]);

    const qrImage = await screen.findAllByAltText('QR Code do WhatsApp');
    expect(qrImage.length).toBeGreaterThan(0);
    expect(screen.getAllByText(/QR necessário/i)[0]).toBeInTheDocument();
  });

  it('attempts to sync instances on mount even without an auth token', async () => {
    mockGetAuthToken.mockReturnValue(null);

    mockApiGet.mockImplementation((url) => {
      if (url.startsWith('/api/integrations/whatsapp/instances')) {
        return Promise.reject({ response: { status: 401 } });
      }
      if (url.startsWith('/api/campaigns')) {
        return Promise.resolve({ items: [] });
      }
      return Promise.resolve({});
    });

    await renderComponent();

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/api/integrations/whatsapp/instances?refresh=1');
    });
  });
});
