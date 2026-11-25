/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

  it('exibe o botão de nova conversa no WhatsApp', async () => {
    const onStartManualConversation = vi.fn();
    render(
      <FilterToolbar
        {...defaultProps}
        onStartManualConversation={onStartManualConversation}
        manualConversationPending={false}
      />
    );

    const button = screen.getByRole('button', {
      name: /nova conversa no whatsapp/i,
    });
    expect(button).toBeInTheDocument();

    // fireEvent em vez de user-event: o tooltip do Radix abre no hover simulado e, no jsdom,
    // às vezes engole o clique (teste instável). O clique real é coberto pelo e2e do piloto.
    fireEvent.click(button);

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

  it('mostra "Conversas (n)", abas Minhas/Todas e filtros rápidos', async () => {
    const onFiltersChange = vi.fn();
    const onQuickFilterChange = vi.fn();
    render(
      <FilterToolbar
        {...defaultProps}
        total={12}
        filters={{ scope: 'team' }}
        onFiltersChange={onFiltersChange}
        onQuickFilterChange={onQuickFilterChange}
      />
    );

    expect(screen.getByRole('heading', { name: /Conversas/ })).toHaveTextContent('Conversas(12)');
    expect(screen.getByRole('tab', { name: 'Todas' })).toHaveAttribute('aria-selected', 'true');

    await userEvent.click(screen.getByRole('tab', { name: 'Minhas' }));
    expect(onFiltersChange).toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Não lidas' }));
    expect(onQuickFilterChange).toHaveBeenCalledWith('unread');
  });

  it('usa a busca por nome ou telefone', async () => {
    const onSearchChange = vi.fn();
    render(<FilterToolbar {...defaultProps} onSearchChange={onSearchChange} />);

    await userEvent.type(screen.getByRole('searchbox', { name: /Buscar conversas/ }), 'a');
    expect(onSearchChange).toHaveBeenCalledWith('a');
  });
});
