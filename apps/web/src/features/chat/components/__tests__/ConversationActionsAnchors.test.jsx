/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { ConversationHeader } from '../ConversationArea/ConversationHeader.jsx';
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
    );

    const actionIds = Object.values(CONVERSATION_ACTION_IDS);
    actionIds.forEach((id) => {
      const elements = document.querySelectorAll(`[id="${id}"]`);
      expect(elements).toHaveLength(1);
      const target = document.getElementById(id);
      expect(target).toHaveAttribute('aria-hidden', 'true');
    });

    const assignButton = screen.getByRole('button', { name: /Atribuir/i });
    expect(assignButton).toBeInTheDocument();
  });
});
