/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, it } from 'vitest';

import { MessageBubble } from '../MessageBubble.jsx';

describe('MessageBubble', () => {
  afterEach(() => {
    cleanup();
  });

  it('renderiza o optionName selecionado quando não há título na metadata', () => {
    const message = {
      id: 'message-option-name-only',
      direction: 'inbound',
      status: 'SENT',
      type: 'poll_update',
      text: '[Mensagem]',
      metadata: {
        poll: {
          selectedOptions: [
            {
              optionName: 'Resposta preferida',
            },
          ],
        },
      },
    };

    render(
      <MessageBubble
        message={message}
        isContinuation={false}
        isTail
        isFirst
        showMetadata={false}
      />
    );

    expect(screen.getByText('Resposta preferida')).toBeInTheDocument();
    expect(screen.queryByText('[Mensagem]')).not.toBeInTheDocument();
  });
});
