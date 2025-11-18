/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { ConversationHeader } from '../ConversationArea/ConversationHeader.jsx';
import { CONVERSATION_ACTION_IDS } from '../../actions/commandAnchors.js';

const mockUseSearchUsersQuery = vi.fn(() => ({ data: [], isLoading: false, error: null, refetch: vi.fn() }));

vi.mock('../../api/useSearchUsersQuery.js', () => ({
  __esModule: true,
  useSearchUsersQuery: (options) => mockUseSearchUsersQuery(options),
}));

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

  beforeEach(() => {
    mockUseSearchUsersQuery.mockReturnValue({ data: [], isLoading: false, error: null, refetch: vi.fn() });
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

  it('expande e foca o editor de próximo passo ao executar a ação de qualificação', async () => {
    const ticket = {
      id: 'ticket-qualify',
      subject: 'Conversa importante',
      pipelineStep: 'Qualificação',
      contact: {
        id: 'contact-qualify',
        name: 'Cliente Qualificação',
        phone: '+55 11 91111-1111',
      },
      metadata: {},
    };

    const onScheduleFollowUp = vi.fn();
    const onFocusComposer = vi.fn();

    render(
      <ConversationHeader
        ticket={ticket}
        typingAgents={[]}
        onAssign={vi.fn()}
        onScheduleFollowUp={onScheduleFollowUp}
        onRegisterResult={vi.fn()}
        onRegisterCallResult={vi.fn()}
        onSendTemplate={vi.fn()}
        onCreateNextStep={vi.fn()}
        onGenerateProposal={vi.fn()}
        onAttachFile={vi.fn()}
        onFocusComposer={onFocusComposer}
        nextStepValue=""
        onNextStepSave={vi.fn()}
      />
    );

    const primaryAction = screen.getByRole('button', { name: 'Registrar próximo passo' });
    fireEvent.click(primaryAction);

    await waitFor(() => {
      expect(screen.getByLabelText('Recolher detalhes')).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText('Descreva o próximo passo combinado');

    await waitFor(() => {
      expect(textarea).toHaveFocus();
    });

    expect(onScheduleFollowUp).not.toHaveBeenCalled();
    expect(onFocusComposer).not.toHaveBeenCalled();
  });

  it('abre o seletor de atribuição e envia o userId escolhido', async () => {
    const ticket = {
      id: 'ticket-assign',
      subject: 'Conversa importante',
      contact: { id: 'contact-assign', name: 'Cliente', phone: '+55 11 92222-2222' },
      metadata: {},
    };

    const onAssign = vi.fn();

    mockUseSearchUsersQuery.mockReturnValue({
      data: [
        { id: 'agent-001', name: 'Fernanda Ribeiro' },
        { id: 'agent-002', name: 'Carlos Nogueira' },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(
      <ConversationHeader
        ticket={ticket}
        typingAgents={[]}
        onAssign={onAssign}
        onScheduleFollowUp={vi.fn()}
        onRegisterResult={vi.fn()}
        onRegisterCallResult={vi.fn()}
        onSendTemplate={vi.fn()}
        onCreateNextStep={vi.fn()}
        onGenerateProposal={vi.fn()}
      />
    );

    const assignButton = screen.getByRole('button', { name: /Atribuir/i });
    fireEvent.click(assignButton);

    await waitFor(() => {
      expect(screen.getByLabelText('Buscar agente')).toBeInTheDocument();
    });

    const agentOption = screen.getByRole('button', { name: 'Fernanda Ribeiro' });
    fireEvent.click(agentOption);

    const confirmButton = screen.getByRole('button', { name: 'Confirmar' });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(onAssign).toHaveBeenCalledWith(ticket, 'agent-001');
    });
  });
});
