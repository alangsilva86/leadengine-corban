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

const { useUpdateNextStepMock, nextStepMutationHolder } = vi.hoisted(() => {
  const holder = { current: { mutateAsync: vi.fn(), isPending: false } };
  const mock = vi.fn(() => holder.current);
  return { useUpdateNextStepMock: mock, nextStepMutationHolder: holder };
});

vi.mock('../api/useUpdateNextStep.js', () => ({
  __esModule: true,
  default: useUpdateNextStepMock,
}));

let nextStepMutationMock;

let mockController;

vi.mock('../hooks/useChatController.js', () => ({
  __esModule: true,
  default: vi.fn(() => mockController),
}));

describe('ChatCommandCenter next step editor', () => {
  beforeEach(() => {
    apiMock.apiGet.mockImplementation(async () => ({ mode: 'assist' }));
    apiMock.apiPost.mockImplementation(async () => ({}));
    nextStepMutationMock = {
      mutateAsync: vi.fn(),
      isPending: false,
    };

    nextStepMutationHolder.current = nextStepMutationMock;
    useUpdateNextStepMock.mockClear();
    useUpdateNextStepMock.mockImplementation(() => nextStepMutationHolder.current);

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
          nextAction: {
            description: 'Falar sobre proposta',
          },
        },
      },
      conversation: {
        timeline: [],
      },
      messagesQuery: {
        data: { pages: [] },
        hasNextPage: false,
        isFetchingNextPage: false,
        fetchNextPage: vi.fn(),
      },
      sendMessageMutation: {
        mutate: vi.fn(),
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
    toast.success.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('chama a mutação com descrição normalizada e metadata padrão', async () => {
    nextStepMutationMock.mutateAsync.mockResolvedValue({ id: 'ticket-1' });

    render(<ChatCommandCenter tenantId="tenant-x" currentUser={{ id: 'agent-42' }} />);

    expect(ConversationAreaMock).toHaveBeenCalled();
    expect(ConversationAreaMock.props?.nextStepValue).toBe('Falar sobre proposta');

    await ConversationAreaMock.props.onNextStepSave?.('  Enviar contrato  ');

    await waitFor(() => {
      expect(nextStepMutationMock.mutateAsync).toHaveBeenCalledTimes(1);
    });

    const payload = nextStepMutationMock.mutateAsync.mock.calls[0][0];
    expect(payload).toEqual(
      expect.objectContaining({
        targetTicketId: 'ticket-1',
        description: 'Enviar contrato',
        metadata: expect.objectContaining({
          updatedFrom: 'chat-command-center',
          updatedBy: 'agent-42',
        }),
      })
    );

    expect(ConversationAreaMock.props?.nextStepValue).toBe('  Enviar contrato  ');
    expect(toast.success).toHaveBeenCalledWith('Próximo passo atualizado.');
  });

  it('propaga erros da API e exibe toast de erro', async () => {
    nextStepMutationMock.mutateAsync.mockRejectedValue(new Error('Falha na API'));

    render(<ChatCommandCenter tenantId="tenant-x" currentUser={{ id: 'agent-42' }} />);

    await expect(
      ConversationAreaMock.props.onNextStepSave?.('Atualizar próxima etapa')
    ).rejects.toThrow('Falha na API');

    expect(toast.error).toHaveBeenCalledWith('Não foi possível atualizar o próximo passo', {
      description: 'Falha na API',
    });
  });

  it('reidrata o rascunho quando o ticket selecionado muda', async () => {
    nextStepMutationMock.mutateAsync.mockResolvedValue({ id: 'ticket-1' });

    const { rerender } = render(
      <ChatCommandCenter tenantId="tenant-x" currentUser={{ id: 'agent-42' }} />
    );

    expect(ConversationAreaMock.props?.nextStepValue).toBe('Falar sobre proposta');

    await act(async () => {
      mockController.selectedTicketId = 'ticket-2';
      mockController.selectedTicket = {
        id: 'ticket-2',
        contact: {
          id: 'contact-2',
          name: 'Outro Cliente',
        },
        metadata: {
          nextAction: {
            description: 'Enviar orçamento atualizado',
          },
        },
      };

      rerender(<ChatCommandCenter tenantId="tenant-x" currentUser={{ id: 'agent-42' }} />);
    });

    await waitFor(() => {
      expect(ConversationAreaMock.props?.nextStepValue).toBe('Enviar orçamento atualizado');
    });

    expect(useUpdateNextStepMock).toHaveBeenLastCalledWith({ ticketId: 'ticket-2' });
  });
});
