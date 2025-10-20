/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import FilterToolbar from '../FilterToolbar/FilterToolbar.jsx';

describe('FilterToolbar', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const defaultProps = {
    search: '',
    onSearchChange: () => {},
    filters: {},
    onFiltersChange: () => {},
    loading: false,
    onRefresh: () => {},
  };

  it('exibe o botão circular com ícone de WhatsApp para iniciar conversa manual', async () => {
    const onStartManualConversation = vi.fn();
    render(
      <FilterToolbar
        {...defaultProps}
        onStartManualConversation={onStartManualConversation}
        manualConversationPending={false}
      />
    );

    const button = screen.getByRole('button', {
      name: /iniciar nova conversa manual no whatsapp/i,
    });
    expect(button).toBeInTheDocument();

    await userEvent.click(button);

    expect(onStartManualConversation).toHaveBeenCalledTimes(1);
  });

  it('exibe aviso quando a conversa manual está indisponível', () => {
    const reason = 'Fluxo indisponível para o tenant atual.';
    render(
      <FilterToolbar
        {...defaultProps}
        manualConversationUnavailableReason={reason}
      />
    );

    expect(
      screen.getByText(reason, { exact: false })
    ).toBeInTheDocument();
  });
});
