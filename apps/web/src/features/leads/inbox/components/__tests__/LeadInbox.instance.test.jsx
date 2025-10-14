/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

import { LeadInbox } from '../LeadInbox.jsx';

const mockUseLeadAllocations = vi.fn();
const mockUseInboxLiveUpdates = vi.fn();

vi.mock('../../hooks/useLeadAllocations.js', () => ({
  __esModule: true,
  useLeadAllocations: (params) => mockUseLeadAllocations(params),
  default: (params) => mockUseLeadAllocations(params),
}));

vi.mock('../../hooks/useManualConversationLauncher.js', () => ({
  __esModule: true,
  useManualConversationLauncher: () => ({
    launch: vi.fn(),
    isPending: false,
  }),
}));

vi.mock('@/features/whatsapp-inbound/sockets/useInboxLiveUpdates.js', () => ({
  __esModule: true,
  default: (params) => mockUseInboxLiveUpdates(params),
  useInboxLiveUpdates: (params) => mockUseInboxLiveUpdates(params),
}));

vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
  },
}));

const sampleLead = {
  allocationId: 'alloc-1',
  status: 'allocated',
  fullName: 'Fulano da Silva',
  document: '12345678901',
  phone: '+55 11 99999-9999',
  score: 820,
  registrations: ['INSS'],
  margin: 1200,
  netMargin: 800,
};

beforeEach(() => {
  mockUseLeadAllocations.mockReturnValue({
    allocations: [sampleLead],
    summary: { total: 1, contacted: 0, won: 0, lost: 0 },
    loading: false,
    error: null,
    warningMessage:
      'Sincronizando leads diretamente pela instância conectada. Vincule uma campanha apenas se precisar de roteamento avançado.',
    rateLimitInfo: { show: false, retryAfter: null, resetSeconds: null },
    refresh: vi.fn(),
    updateAllocationStatus: vi.fn(),
    lastUpdatedAt: new Date(),
    nextRefreshAt: null,
  });
  mockUseInboxLiveUpdates.mockReturnValue({ connected: true, connectionError: null });

  if (!window.ResizeObserver) {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (!window.CSS) {
    window.CSS = {};
  }
  if (typeof window.CSS.escape !== 'function') {
    window.CSS.escape = (value) => String(value);
  }
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = vi.fn();
  }
  if (!HTMLElement.prototype.focus) {
    HTMLElement.prototype.focus = vi.fn();
  }
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('LeadInbox instance fallback', () => {
  it('renderiza leads usando apenas o instanceId como contexto', async () => {
    render(
      <LeadInbox
        selectedAgreement={null}
        campaign={null}
        instanceId="waba-instance-01"
        onboarding={{ stages: [], activeStep: 3 }}
        onSelectAgreement={vi.fn()}
        onBackToWhatsApp={vi.fn()}
      />
    );

    expect(mockUseLeadAllocations).toHaveBeenCalled();
    const [firstCall] = mockUseLeadAllocations.mock.calls;
    expect(firstCall?.[0]).toMatchObject({
      agreementId: undefined,
      campaignId: undefined,
      instanceId: 'waba-instance-01',
    });

    expect(mockUseInboxLiveUpdates).toHaveBeenCalled();
    const lastRealtimeCall = mockUseInboxLiveUpdates.mock.calls.at(-1);
    expect(lastRealtimeCall?.[0]).toMatchObject({
      enabled: true,
      tenantId: null,
    });

    await waitFor(() => {
      expect(screen.getByText('Fulano da Silva')).toBeInTheDocument();
    });
    expect(screen.getByText(/instância conectada/i)).toBeInTheDocument();
  });
});
