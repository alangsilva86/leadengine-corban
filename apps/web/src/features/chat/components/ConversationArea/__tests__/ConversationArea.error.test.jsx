/* @vitest-environment jsdom */
import { act, render, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ConversationArea from '../ConversationArea.jsx';
import { useConversationExperience } from '../hooks/useConversationExperience.js';
import { buildAiContextTimeline } from '../../../utils/aiTimeline.js';

const startMock = vi.fn();

vi.mock('../../../hooks/useAiSuggestions.js', () => ({
  __esModule: true,
  default: vi.fn(() => ({
    requestSuggestions: vi.fn(),
    isLoading: false,
    data: null,
    error: null,
    reset: vi.fn(),
  })),
}));

vi.mock('../../../hooks/useAiReplyStream.js', () => ({
  __esModule: true,
  default: vi.fn(() => ({
    status: 'idle',
    message: '',
    toolCalls: [],
    model: null,
    usage: null,
    error: null,
    start: startMock,
    cancel: vi.fn(),
    reset: vi.fn(),
  })),
}));

vi.mock('../../../hooks/useChatAutoscroll.js', () => ({
  __esModule: true,
  default: vi.fn(() => ({
    scrollRef: { current: null },
    scrollToBottom: vi.fn(),
    isNearBottom: true,
  })),
}));

vi.mock('../../../hooks/useWhatsAppPresence.js', () => ({
  __esModule: true,
  default: vi.fn(() => ({ typingAgents: [], broadcastTyping: vi.fn() })),
}));

vi.mock('../../../hooks/useSLAClock.js', () => ({
  __esModule: true,
  default: vi.fn(() => ({ now: new Date() })),
}));

vi.mock('../../../utils/telemetry.js', () => ({
  __esModule: true,
  default: vi.fn(),
}));

describe('ConversationArea', () => {
  beforeEach(() => {
    startMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders with minimal ticket and handlers', () => {
    const ticket = {
      id: 'ticket-1',
      status: 'OPEN',
      contact: {
        name: 'Cliente Teste',
        phone: '+55 11 9999-0001',
        id: 'c1',
      },
      lead: { id: 'lead-1', value: 20000, probability: 70 },
      timeline: {},
      window: {},
      metadata: {},
    };

    const conversation = { timeline: [] };
    const messagesQuery = {
      data: { pages: [] },
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: () => {},
    };

    const typingIndicator = {
      agentsTyping: [],
      broadcastTyping: () => {},
    };

    const queryClient = new QueryClient();

    const { getByText } = render(
      <QueryClientProvider client={queryClient}>
        <ConversationArea
          ticket={ticket}
          conversation={conversation}
          messagesQuery={messagesQuery}
          onSendMessage={() => {}}
          onCreateNote={() => {}}
          onSendTemplate={() => {}}
          onCreateNextStep={() => {}}
          onRegisterResult={() => {}}
          onRegisterCallResult={() => {}}
          onAssign={() => {}}
          onGenerateProposal={() => {}}
          onScheduleFollowUp={() => {}}
          onSendSMS={() => {}}
          onEditContact={() => {}}
          onAttachFile={() => {}}
          typingIndicator={typingIndicator}
        />
      </QueryClientProvider>
    );

    expect(getByText('Cliente Teste')).toBeDefined();
  });

  it('usa a sanitização compartilhada ao iniciar a geração de resposta da IA', async () => {
    const messagesQuery = {
      data: {
        pages: [
          {
            items: Array.from({ length: 55 }, (_, index) => ({
              id: `message-${index + 1}`,
              createdAt: `2024-01-${String(index + 1).padStart(2, '0')}T10:00:00.000Z`,
              content: `Mensagem ${index + 1}`,
              role: index % 2 === 0 ? 'outbound' : 'inbound',
              direction: index % 2 === 0 ? 'outbound' : 'inbound',
            })),
          },
        ],
      },
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
    };

    const ticket = {
      id: 'ticket-123',
      contact: { id: 'contact-1' },
      lead: { id: 'lead-99' },
    };

    const typingIndicator = { agentsTyping: [], broadcastTyping: vi.fn() };

    const queryClient = new QueryClient();
    const wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(
      () =>
        useConversationExperience({
          ticket,
          conversation: { timeline: [] },
          messagesQuery,
          typingIndicator,
          onSendMessage: vi.fn(),
          onCreateNote: vi.fn(),
          onSendTemplate: vi.fn(),
          onCreateNextStep: vi.fn(),
          onRegisterResult: vi.fn(),
          onRegisterCallResult: vi.fn(),
          onAssign: vi.fn(),
          onGenerateProposal: vi.fn(),
          onScheduleFollowUp: vi.fn(),
          onSendSMS: vi.fn(),
          onEditContact: vi.fn(),
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.composer.aiStreaming.onGenerate();
    });

    expect(startMock).toHaveBeenCalledTimes(1);
    const [payload] = startMock.mock.calls[0];
    expect(payload.conversationId).toBe('ticket-123');
    expect(payload.metadata).toEqual({
      ticketId: 'ticket-123',
      contactId: 'contact-1',
      leadId: 'lead-99',
    });
    expect(payload.timeline).toEqual(buildAiContextTimeline(result.current.timeline.items));

    queryClient.clear();
  });
});
