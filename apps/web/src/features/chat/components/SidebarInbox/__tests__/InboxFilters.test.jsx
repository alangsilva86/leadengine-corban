import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { InboxFilters } from '../InboxFilters.jsx';

const renderComponent = (overrides = {}) => {
  const props = {
    filters: {
      scope: 'team',
      window: 'in_window',
      outcome: null,
    },
    onFiltersChange: vi.fn(),
    search: '',
    onSearchChange: vi.fn(),
    onRefresh: vi.fn(),
    loading: false,
    ...overrides,
  };

  const utils = render(<InboxFilters {...props} />);

  return { props, ...utils };
};

const getToggleByName = (label) => {
  const toggles = screen.getAllByRole('radio', { name: label });
  return toggles[toggles.length - 1];
};

describe('InboxFilters', () => {
  it('updates the scope filter when a new option is selected', async () => {
    const user = userEvent.setup();
    const { props } = renderComponent();

    await user.click(getToggleByName('Meus'), { pointerEventsCheck: 0 });

    expect(props.onFiltersChange).toHaveBeenCalledWith({ scope: 'mine' });
  });

  it('updates the window filter when a new option is selected', async () => {
    const user = userEvent.setup();
    const { props } = renderComponent();

    await user.click(getToggleByName('Expirados'), { pointerEventsCheck: 0 });

    expect(props.onFiltersChange).toHaveBeenCalledWith({ window: 'expired' });
  });

  it('updates the outcome filter and restores default when cleared', async () => {
    const user = userEvent.setup();
    const { props } = renderComponent();

    const ganhoButton = getToggleByName('Ganho');
    await user.click(ganhoButton, { pointerEventsCheck: 0 });
    expect(props.onFiltersChange).toHaveBeenLastCalledWith({ outcome: 'won' });

    await user.click(ganhoButton, { pointerEventsCheck: 0 });
    expect(props.onFiltersChange).toHaveBeenLastCalledWith({ outcome: null });
  });

  it('reflects loading state on the refresh button', async () => {
    const user = userEvent.setup();
    const { props, rerender } = renderComponent();

    const refreshButtons = screen.getAllByRole('button', { name: /^Sincronizar$/ });
    const refreshButton = refreshButtons[refreshButtons.length - 1];
    await user.click(refreshButton, { pointerEventsCheck: 0 });
    expect(props.onRefresh).toHaveBeenCalled();

    rerender(
      <InboxFilters
        {...props}
        loading
      />
    );

    expect(screen.getByRole('button', { name: /Sincronizando…/ })).toBeDisabled();
  });
});
