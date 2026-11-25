/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { usePollMessage } from '../../../hooks/usePollMessage.js';

import { MessageBubble } from '../MessageBubble.jsx';

vi.mock('../../../hooks/usePollMessage.js', () => {
  const usePollMessageMock = vi.fn();
  return {
    __esModule: true,
    usePollMessage: usePollMessageMock,
    default: usePollMessageMock,
  };
});

describe('MessageBubble', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    usePollMessage.mockReturnValue({
      textContent: 'Mensagem padrão',
      shouldForceText: false,
      voteBubble: { shouldRender: false },
      pollBubble: { shouldRender: false },
    });
  });

  it('renderiza o optionName selecionado quando não há título na metadata', async () => {
    usePollMessage.mockReturnValue({
      textContent: 'Resposta preferida',
      shouldForceText: true,
      voteBubble: {
        shouldRender: true,
        question: 'Qual é a sua opção?',
        pollId: 'poll-123',
        totalVotes: 5,
        totalVoters: 4,
        updatedAtIso: '2024-01-01T12:00:00.000Z',
        selectedOptions: [{ id: 'opt-1', title: 'Resposta preferida' }],
        textContent: 'Resposta preferida',
      },
      pollBubble: { shouldRender: false },
    });

    render(
      <MessageBubble
        message={{
          id: 'message-option-name-only',
          direction: 'inbound',
          status: 'SENT',
          type: 'poll_update',
          text: '[Mensagem]',
        }}
        isContinuation={false}
        isTail
        isFirst
        showMetadata={false}
      />
    );

    expect(screen.getByText('Carregando enquete…')).toBeInTheDocument();
    expect((await screen.findAllByText('Resposta preferida')).length).toBeGreaterThan(0);
    expect(screen.queryByText('[Mensagem]')).not.toBeInTheDocument();
  });

  it('exibe conteúdo de texto padrão quando o hook não sinaliza enquete', () => {
    const message = {
      id: 'message-text',
      direction: 'inbound',
      status: 'DELIVERED',
      type: 'text',
      text: 'Mensagem sem fallback',
    };

    usePollMessage.mockReturnValue({
      textContent: message.text,
      shouldForceText: false,
      voteBubble: { shouldRender: false },
      pollBubble: { shouldRender: false },
    });

    render(
      <MessageBubble
        message={message}
        isContinuation={false}
        isTail
        isFirst
        showMetadata={false}
      />
    );

    expect(usePollMessage).toHaveBeenCalledWith({
      message,
      messageType: 'text',
      rawTextContent: 'Mensagem sem fallback',
    });
    expect(screen.getByText('Mensagem sem fallback')).toBeInTheDocument();
    expect(screen.queryByText('Carregando enquete…')).not.toBeInTheDocument();
  });

  it('mostra confirmação de leitura apenas em mensagens enviadas', () => {
    usePollMessage.mockReturnValue({
      textContent: 'Proposta enviada',
      shouldForceText: false,
      voteBubble: { shouldRender: false },
      pollBubble: { shouldRender: false },
    });

    const { rerender } = render(
      <MessageBubble
        message={{ id: 'out-1', direction: 'OUTBOUND', status: 'READ', type: 'text', text: 'Proposta enviada', createdAt: '2024-01-01T12:00:00.000Z' }}
        authorLabel="Você"
      />,
    );

    expect(screen.getByText('Lida')).toBeInTheDocument();
    expect(screen.getByText('Você')).toBeInTheDocument();
    expect(screen.queryByText('IN')).not.toBeInTheDocument();
    expect(screen.queryByText('OUT')).not.toBeInTheDocument();

    rerender(
      <MessageBubble
        message={{ id: 'in-1', direction: 'INBOUND', status: 'READ', type: 'text', text: 'Proposta enviada', createdAt: '2024-01-01T12:00:00.000Z' }}
      />,
    );

    expect(screen.queryByText('Lida')).not.toBeInTheDocument();
  });

  it('sinaliza falha no envio', () => {
    usePollMessage.mockReturnValue({
      textContent: 'Oi',
      shouldForceText: false,
      voteBubble: { shouldRender: false },
      pollBubble: { shouldRender: false },
    });

    render(<MessageBubble message={{ id: 'failed', direction: 'outbound', status: 'FAILED', type: 'text', text: 'Oi' }} />);

    expect(screen.getAllByText(/Falha no envio/).length).toBeGreaterThan(0);
  });
});
