import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import LeadInbox from '../components/LeadInbox.jsx';

vi.mock('../hooks/useLeadAllocations.js', () => ({
  useLeadAllocations: () => ({
    allocations: [],
    summary: { total: 0, contacted: 0, won: 0, lost: 0 },
    loading: false,
    error: null,
    warningMessage: null,
    rateLimitInfo: { show: false },
    refresh: vi.fn(),
    updateAllocationStatus: vi.fn(),
    lastUpdatedAt: null,
    nextRefreshAt: null,
  }),
}));

vi.mock('@/components/ui/card.jsx', () => ({
  Card: ({ children }) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }) => <div>{children}</div>,
  CardTitle: ({ children }) => <h2>{children}</h2>,
  CardDescription: ({ children }) => <p>{children}</p>,
  CardContent: ({ children }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/badge.jsx', () => ({ Badge: ({ children }) => <span>{children}</span> }));
vi.mock('@/components/ui/button.jsx', () => ({ Button: ({ children }) => <button>{children}</button> }));
vi.mock('@/components/ui/button-group.jsx', () => ({ ButtonGroup: ({ children }) => <div>{children}</div> }));
vi.mock('@/components/ui/notice-banner.jsx', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('@/components/ui/tooltip.jsx', () => ({
  Tooltip: ({ children }) => <>{children}</>,
  TooltipTrigger: ({ children }) => <>{children}</>,
  TooltipContent: ({ children }) => <div>{children}</div>,
}));

vi.mock('lucide-react', () => ({
  AlertCircle: () => null,
  Trophy: () => null,
  XCircle: () => null,
  Download: () => null,
  RefreshCcw: () => null,
  Sparkles: () => null,
  Loader2: () => null,
}));

vi.mock('@/features/whatsapp-inbound/sockets/useInboxLiveUpdates.js', () => ({
  __esModule: true,
  default: () => ({ connected: false, connectionError: null }),
}));

describe('LeadInbox', () => {
  it('renders empty state when there are no leads', () => {
    render(
      <LeadInbox
        selectedAgreement={{ name: 'Convênio Teste' }}
        campaign={{ name: 'Campanha Teste' }}
        onboarding={{ stages: [], activeStep: 0 }}
        onSelectAgreement={vi.fn()}
        onBackToWhatsApp={vi.fn()}
      />
    );

    expect(screen.getByText(/Sem leads por aqui/)).toBeInTheDocument();
  });
});
