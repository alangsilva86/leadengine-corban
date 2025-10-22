/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { ConversationHeader } from '../ConversationArea/ConversationHeader.jsx';
import DetailsPanel from '../DetailsPanel/DetailsPanel.jsx';
import { CONVERSATION_ACTION_IDS } from '../../actions/commandAnchors.js';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('../../utils/telemetry.js', () => ({
  __esModule: true,
  default: vi.fn(),
}));

const mockPhoneAction = vi.fn();

vi.mock('../../hooks/usePhoneActions.js', () => ({
  __esModule: true,
  usePhoneActions: vi.fn(() => mockPhoneAction),
}));

vi.mock('@/hooks/use-clipboard.js', () => ({
  __esModule: true,
  useClipboard: () => ({
    copy: vi.fn(),
  }),
}));

vi.mock('../ConversationArea/QuickComposer.jsx', () => ({
  __esModule: true,
  default: () => <div data-testid="quick-composer">QuickComposer</div>,
}));

vi.mock('../ConversationArea/CallResultDialog.jsx', () => ({
  __esModule: true,
  default: () => <div data-testid="call-result-dialog">CallResultDialog</div>,
}));

vi.mock('../ConversationArea/LossReasonDialog.jsx', () => ({
  __esModule: true,
  default: () => <div data-testid="loss-reason-dialog">LossReasonDialog</div>,
}));

vi.mock('../DetailsPanel/LeadSummaryCard.jsx', () => ({
  __esModule: true,
  default: ({ lead }) => <div data-testid="lead-summary">Lead summary: {lead?.status ?? 'unknown'}</div>,
}));

vi.mock('../DetailsPanel/LeadDetailsTabs.jsx', () => ({
  __esModule: true,
  default: ({ ticket }) => <div data-testid="lead-details">Lead details tabs: {ticket?.id ?? 'no-ticket'}</div>,
}));

vi.mock('../DetailsPanel/ConsentInfo.jsx', () => ({
  __esModule: true,
  default: ({ consent }) => <div data-testid="consent-info">Consent: {JSON.stringify(consent)}</div>,
}));

vi.mock('../DetailsPanel/ProposalMiniSim.jsx', () => ({
  __esModule: true,
  default: () => <div data-testid="proposal-mini-sim">Proposal mini sim</div>,
}));

vi.mock('../DetailsPanel/NotesSection.jsx', () => ({
  __esModule: true,
  default: vi.fn(() => <div data-testid="notes-section">Notes section</div>),
}));

vi.mock('../DetailsPanel/TasksSection.jsx', () => ({
  __esModule: true,
  default: ({ ticket }) => <div data-testid="tasks-section">Tasks for {ticket?.id ?? 'no-ticket'}</div>,
}));

vi.mock('../DetailsPanel/AuditTrailLink.jsx', () => ({
  __esModule: true,
  default: ({ onOpenAudit }) => (
    <button type="button" data-testid="audit-trail" onClick={onOpenAudit}>
      Abrir auditoria
    </button>
  ),
}));

vi.mock('../Shared/AttachmentPreview.jsx', () => ({
  __esModule: true,
  default: ({ attachments }) => (
    <div data-testid="attachment-preview">Attachments: {attachments.length}</div>
  ),
}));

vi.mock('../Shared/StatusBadge.jsx', () => ({
  __esModule: true,
  default: ({ status }) => <div data-testid="status-badge">Status: {status}</div>,
}));

describe('Conversation actions anchors', () => {
  beforeAll(() => {
    vi.stubGlobal('requestAnimationFrame', (callback) => {
      const id = setTimeout(() => callback(Date.now()), 0);
      return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id) => {
      clearTimeout(id);
    });
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('mantém IDs únicos e permite navegação pelo QuickActionsBar', async () => {
    const user = userEvent.setup();

    const ticket = {
      id: 'ticket-001',
      subject: 'Conversa importante',
      contact: {
        id: 'contact-001',
        name: 'João da Silva',
        phone: '+55 11 90000-0000',
        document: '123.456.789-00',
        email: 'joao@example.com',
        consent: { whatsapp: true },
      },
      metadata: {
        attachments: [],
        contactPhone: '+55 11 90000-0000',
        contactEmail: 'joao@example.com',
      },
      lead: {
        id: 'lead-123',
        status: 'OPEN',
        value: 10000,
      },
      timeline: {
        lastDirection: 'INBOUND',
        lastInboundAt: '2023-09-10T10:00:00Z',
        unreadInboundCount: 1,
      },
      notes: [],
    };

    render(
      <>
        <ConversationHeader
          ticket={ticket}
          typingAgents={[]}
          onAssign={vi.fn()}
          onScheduleFollowUp={vi.fn()}
          onRegisterResult={vi.fn()}
          onRegisterCallResult={vi.fn()}
          onSendTemplate={vi.fn()}
          onCreateNextStep={vi.fn()}
          onGenerateProposal={vi.fn()}
        />
        <DetailsPanel
          ticket={ticket}
          onCreateNote={vi.fn()}
          notesLoading={false}
          onReopenWindow={vi.fn()}
          onOpenAudit={vi.fn()}
        />
      </>,
    );

    const toggleButton = screen.getByRole('button', { name: /expandir detalhes/i });
    await user.click(toggleButton);

    const actionIds = Object.values(CONVERSATION_ACTION_IDS);
    actionIds.forEach((id) => {
      const elements = document.querySelectorAll(`[id="${id}"]`);
      expect(elements).toHaveLength(1);
    });

    const assignLink = screen.getByRole('link', { name: 'Atribuir' });
    expect(assignLink).toHaveAttribute('href', '#conversation-action-assign');

    const target = document.querySelector(assignLink.getAttribute('href'));
    expect(target).toBeInTheDocument();
  });
});
