/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { usePollMessage } from '../../hooks/usePollMessage.js';

import { MessageBubble } from '../MessageBubble.jsx';

vi.mock('../../hooks/usePollMessage.js', () => {
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
    await screen.findByText('Resposta preferida');
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
});
