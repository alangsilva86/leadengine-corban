/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import ChatCommandCenter from '../containers/ChatCommandCenterContainer.js';

const apiMock = vi.hoisted(() => ({
  apiGet: vi.fn(async () => ({ mode: 'assist' })),
  apiPost: vi.fn(async () => ({})),
}));

vi.mock('@/lib/api.js', () => ({
  __esModule: true,
  apiGet: apiMock.apiGet,
  apiPost: apiMock.apiPost,
}));

vi.mock('@/lib/auth.js', () => {
  const getTenantId = vi.fn(() => 'test-tenant');
  const onTenantIdChange = vi.fn(() => () => {});
  const mock = {
    getAuthToken: vi.fn(() => null),
    setAuthToken: vi.fn(),
    clearAuthToken: vi.fn(),
    onAuthTokenChange: vi.fn(() => () => {}),
    getTenantId,
    setTenantId: vi.fn(),
    clearTenantId: vi.fn(),
    onTenantIdChange,
    loginWithCredentials: vi.fn(async () => ({ token: null, tenantId: 'test-tenant', payload: { mode: 'demo' } })),
    logout: vi.fn(),
  };
  return {
    ...mock,
    default: mock,
  };
});

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    loading: vi.fn(),
  },
}));

const ConversationAreaMock = vi.hoisted(() => {
  const mock = vi.fn((props) => {
    mock.props = props;
    return <div data-testid="conversation-area" />;
  });
  return mock;
});

vi.mock('../components/ConversationArea/ConversationArea.jsx', () => ({
  __esModule: true,
  default: ConversationAreaMock,
}));

vi.mock('../components/layout/InboxAppShell.jsx', () => ({
  __esModule: true,
  default: ({ sidebar, toolbar, children }) => (
    <div>
      <div>{sidebar}</div>
      <div>{toolbar}</div>
      <div>{children}</div>
    </div>
  ),
}));

vi.mock('../components/QueueList/QueueList.jsx', () => ({
  __esModule: true,
  default: () => <div data-testid="queue-list" />,
}));

vi.mock('../components/FilterToolbar/FilterToolbar.jsx', () => ({
  __esModule: true,
  default: () => <div data-testid="filter-toolbar" />,
}));

vi.mock('../components/ManualConversationDialog.jsx', () => ({
  __esModule: true,
  default: () => <div data-testid="manual-conversation-dialog" />,
}));

vi.mock('../hooks/useManualConversationLauncher.js', () => ({
  __esModule: true,
  useManualConversationLauncher: () => ({
    launch: vi.fn(),
    isPending: false,
  }),
}));

const { useUpdateNextStepMock, nextStepMutationHolder } = vi.hoisted(() => {
  const holder = { current: { mutateAsync: vi.fn(), isPending: false } };
  const mock = vi.fn(() => holder.current);
  return { useUpdateNextStepMock: mock, nextStepMutationHolder: holder };
});

vi.mock('../api/useUpdateNextStep.js', () => ({
  __esModule: true,
  default: useUpdateNextStepMock,
}));

vi.mock('../api/useUpdateContactField', () => ({
  __esModule: true,
  default: () => ({
    mutateAsync: vi.fn(async () => ({})),
  }),
}));

vi.mock('../api/useUpdateDealFields.js', () => ({
  __esModule: true,
  default: () => ({
    mutateAsync: vi.fn(async () => ({})),
  }),
}));

let mockController;

vi.mock('../hooks/useChatController.js', () => ({
  __esModule: true,
  default: vi.fn(() => mockController),
}));

let sendMessageMutate;

describe('ChatCommandCenter WhatsApp integration errors', () => {
  beforeEach(() => {
    apiMock.apiGet.mockImplementation(async () => ({ mode: 'assist' }));
    apiMock.apiPost.mockImplementation(async () => ({}));
    nextStepMutationHolder.current = {
      mutateAsync: vi.fn(async () => ({})),
      isPending: false,
    };
    useUpdateNextStepMock.mockClear();
    useUpdateNextStepMock.mockImplementation(() => nextStepMutationHolder.current);

    sendMessageMutate = vi.fn();
    mockController = {
      tickets: [],
      selectedTicketId: 'ticket-1',
      selectedTicket: {
        id: 'ticket-1',
        contact: {
          id: 'contact-1',
          name: 'Cliente Teste',
          phone: '+5511999999999',
          email: 'cliente@example.com',
        },
        metadata: {
          pipelineStep: 'Novo',
          contactPhone: '+5511999999999',
        },
      },
      conversation: {
        timeline: [
          { id: 'divider-1', type: 'divider' },
          { id: 'message-1', type: 'message' },
          { id: 'event-1', type: 'event' },
        ],
      },
      messagesQuery: {
        data: { pages: [] },
        hasNextPage: false,
        isFetchingNextPage: false,
        fetchNextPage: vi.fn(),
      },
      sendMessageMutation: {
        mutate: sendMessageMutate,
        isPending: false,
        error: null,
      },
      notesMutation: { mutate: vi.fn(), isPending: false },
      statusMutation: { mutateAsync: vi.fn(), isPending: false },
      assignMutation: { mutate: vi.fn() },
      ticketsQuery: { isFetching: false, refetch: vi.fn() },
      queueAlerts: [],
      typingIndicator: { agentsTyping: [], broadcastTyping: vi.fn() },
      metrics: {},
      filters: { search: '' },
      setFilters: vi.fn(),
      setSearch: vi.fn(),
      selectTicket: vi.fn(),
    };
    ConversationAreaMock.mockClear();
    ConversationAreaMock.props = undefined;
    toast.error.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('locks the composer and shows WhatsApp configuration guidance on broker errors', async () => {
    sendMessageMutate.mockImplementation((_payload, options) => {
      options?.onError?.({
        message: 'Broker indisponível',
        payload: { code: 'BROKER_NOT_CONFIGURED' },
      });
    });

    render(<ChatCommandCenter tenantId="tenant-x" currentUser={{ id: 'agent-1' }} />);

    expect(ConversationAreaMock).toHaveBeenCalled();
    const initialProps = ConversationAreaMock.props;
    expect(initialProps.composerDisabled).toBe(false);

    initialProps.onSendMessage?.({ content: 'Olá', attachments: [] });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'WhatsApp não configurado',
        expect.objectContaining({
          description: expect.stringContaining('Conecte uma instância do WhatsApp'),
        })
      );
    });

    await waitFor(() => {
      expect(ConversationAreaMock.props?.composerDisabled).toBe(true);
    });

    expect(ConversationAreaMock.props?.composerDisabledReason).toMatchObject({
      code: 'BROKER_NOT_CONFIGURED',
      title: 'WhatsApp não configurado',
    });
  });

  it('exposes offline notice with request metadata for transient broker errors', async () => {
    sendMessageMutate.mockImplementation((_payload, options) => {
      options?.onError?.({
        status: 502,
        message: 'BROKER_ERROR',
        payload: { error: { code: 'BROKER_ERROR', requestId: 'req-123', recoveryHint: 'Guardamos a mensagem.' } },
      });
    });

    render(<ChatCommandCenter tenantId="tenant-x" currentUser={{ id: 'agent-1' }} />);
    const props = ConversationAreaMock.props;
    props.onSendMessage?.({ content: 'Oi', attachments: [] });

    await waitFor(() => {
      expect(ConversationAreaMock.props?.composerNotice).toMatchObject({
        code: 'BROKER_ERROR',
        requestId: 'req-123',
        actionLabel: 'Reconectar ao WhatsApp',
      });
    });
  });

  it('sincroniza modo de IA com API e persiste alterações', async () => {
    apiMock.apiGet.mockResolvedValueOnce({ mode: 'auto' });

    render(<ChatCommandCenter tenantId="tenant-x" currentUser={{ id: 'agent-1' }} />);

    await waitFor(() => {
      expect(apiMock.apiGet).toHaveBeenCalledWith('/api/ai/mode');
    });

    await waitFor(() => {
      expect(ConversationAreaMock.props?.aiMode).toBe('auto');
      expect(ConversationAreaMock.props?.aiModeChangeDisabled).toBe(false);
      expect(typeof ConversationAreaMock.props?.onAiModeChange).toBe('function');
    });

    await act(async () => {
      ConversationAreaMock.props.onAiModeChange?.('manual');
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(apiMock.apiPost).toHaveBeenCalledWith('/api/ai/mode', { mode: 'manual' });
      expect(ConversationAreaMock.props?.aiMode).toBe('manual');
    });
  });
});
