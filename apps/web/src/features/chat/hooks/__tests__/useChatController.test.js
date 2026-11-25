/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api.js', () => ({
  __esModule: true,
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
  API_BASE_URL: '',
}));

const typingIndicatorMock = vi.hoisted(() => ({
  agentsTyping: [],
  viewersByTicket: {},
  broadcastTyping: () => {},
  stopTyping: () => {},
  registerTypingEvent: () => {},
  registerViewersEvent: () => {},
}));
const useTypingIndicatorMock = vi.hoisted(() => vi.fn(() => typingIndicatorMock));

vi.mock('../useTypingIndicator.js', () => ({
  __esModule: true,
  default: useTypingIndicatorMock,
}));

const useRealtimeTicketsMock = vi.fn((options = {}) => {
  useRealtimeTicketsMock.lastOptions = options;
  return { socket: { on: vi.fn(), off: vi.fn() } };
});

vi.mock('../useRealtimeTickets.js', () => ({
  __esModule: true,
  default: useRealtimeTicketsMock,
}));

let apiGet;
let useChatController;

describe('useChatController realtime message handling', () => {
  const ticket = {
    id: 'ticket-123',
    notes: [],
    timeline: {},
    window: 'open',
  };

  const initialMessage = {
    id: 'message-1',
    ticketId: ticket.id,
    direction: 'INBOUND',
    content: 'Olá',
    createdAt: '2024-01-01T10:00:00.000Z',
  };

  let serverMessages;
  let queryClient;

  beforeEach(async () => {
    ({ apiGet } = await import('@/lib/api.js'));
    ({ default: useChatController } = await import('../useChatController.js'));
    serverMessages = [initialMessage];
    apiGet.mockImplementation(async (path) => {
      if (path.startsWith('/api/tickets?')) {
        return {
          data: {
            items: [ticket],
            metrics: { total: 1 },
            pagination: { page: 1, limit: 40 },
          },
        };
      }

      if (path.startsWith(`/api/tickets/${ticket.id}/messages`)) {
        return {
          data: {
            items: [...serverMessages],
            cursors: { next: null },
          },
        };
      }

      throw new Error(`Unexpected apiGet path: ${path}`);
    });

    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
    apiGet?.mockReset();
    useRealtimeTicketsMock.mockClear();
    useRealtimeTicketsMock.lastOptions = undefined;
  });

  it('appends inbound messages received via realtime updates', async () => {
    const wrapper = ({ children }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(
      () => useChatController({ tenantId: 'tenant-1', currentUser: { id: 'agent-1' } }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.selectedTicketId).toBe(ticket.id);
      expect(result.current.conversation.messages).toHaveLength(1);
      expect(result.current.conversation.messages[0].id).toBe(initialMessage.id);
    });

    expect(useRealtimeTicketsMock).toHaveBeenCalled();
    const options = useRealtimeTicketsMock.lastOptions;
    expect(options?.onMessageCreated).toBeInstanceOf(Function);

    const newMessage = {
      id: 'message-2',
      ticketId: ticket.id,
      direction: 'INBOUND',
      content: 'Tudo bem?',
      createdAt: '2024-01-01T11:00:00.000Z',
    };

    serverMessages = [newMessage, ...serverMessages];

    await act(async () => {
      options.onMessageCreated?.({ ticketId: ticket.id, message: newMessage });
    });

    await waitFor(() => {
      const ids = result.current.conversation.messages.map((message) => message.id);
      expect(ids).toEqual([initialMessage.id, newMessage.id]);
    });
  });

  // Antes o controller nunca passava onTyping: os eventos `ticket:typing` chegavam e eram descartados.
  it('forwards teammates typing/viewers events to the typing indicator (ignoring the current user)', async () => {
    const wrapper = ({ children }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);

    renderHook(() => useChatController({ tenantId: 'tenant-1', currentUser: { id: 'agent-1' } }), { wrapper });

    await waitFor(() => expect(useRealtimeTicketsMock.lastOptions).toBeDefined());
    expect(useTypingIndicatorMock).toHaveBeenCalledWith(expect.objectContaining({ currentUserId: 'agent-1' }));
    expect(useRealtimeTicketsMock.lastOptions.onTyping).toBe(typingIndicatorMock.registerTypingEvent);
    expect(useRealtimeTicketsMock.lastOptions.onViewers).toBe(typingIndicatorMock.registerViewersEvent);
  });
});
