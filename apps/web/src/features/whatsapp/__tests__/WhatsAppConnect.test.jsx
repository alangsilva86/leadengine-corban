/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
const mockApiPatch = vi.fn();
const mockApiDelete = vi.fn();

vi.mock('@/lib/api.js', () => ({
  apiGet: (...args) => mockApiGet(...args),
  apiPost: (...args) => mockApiPost(...args),
  apiPatch: (...args) => mockApiPatch(...args),
  apiDelete: (...args) => mockApiDelete(...args),
}));

vi.mock('@/lib/auth.js', () => ({
  getAuthToken: vi.fn(() => 'token-123'),
  onAuthTokenChange: vi.fn(() => () => {}),
}));

vi.mock('@/lib/session-storage.js', () => ({
  default: () => false,
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

vi.mock('@/components/DemoAuthDialog.jsx', () => ({
  default: () => null,
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
});

afterEach(() => {
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
        expect.stringContaining('/api/integrations/whatsapp/instances?agreementId=agreement-1')
      );
    });

    const instanceLabels = await screen.findAllByText('Instância Demo');
    expect(instanceLabels.length).toBeGreaterThan(0);
  });

  it('keeps disconnected broker sessions visible for recovery actions', async () => {
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

    const brokerInstance = await screen.findAllByText('WhatsApp Broker Desconectado');
    expect(brokerInstance.length).toBeGreaterThan(0);
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

    const confirmButton = await screen.findByRole('button', { name: /confirmar criação/i });
    await userEvent.setup().click(confirmButton);

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

    const qrButtons = await screen.findAllByRole('button', { name: /ver qr/i });
    await userEvent.setup().click(qrButtons[0]);

    const qrImage = await screen.findAllByAltText('QR Code do WhatsApp');
    expect(qrImage.length).toBeGreaterThan(0);
    expect(screen.getAllByText(/QR necessário/i)[0]).toBeInTheDocument();
  });
});
