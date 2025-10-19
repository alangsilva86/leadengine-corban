/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { MANUAL_CONVERSATION_DEPRECATION_MESSAGE } from '../../hooks/useManualConversationLauncher.js';
import FilterToolbar from '../FilterToolbar/FilterToolbar.jsx';

describe('FilterToolbar', () => {
  afterEach(() => {
    cleanup();
  });

  const defaultProps = {
    search: '',
    onSearchChange: () => {},
    filters: {},
    onFiltersChange: () => {},
    loading: false,
    onRefresh: () => {},
  };

  it('omite a ação de nova conversa e exibe aviso quando o fluxo manual está indisponível', () => {
    const { container } = render(
      <FilterToolbar
        {...defaultProps}
        manualConversationUnavailableReason={MANUAL_CONVERSATION_DEPRECATION_MESSAGE}
      />
    );

    expect(screen.queryByRole('button', { name: /nova conversa/i })).not.toBeInTheDocument();
    expect(screen.getByText(MANUAL_CONVERSATION_DEPRECATION_MESSAGE)).toBeInTheDocument();

    expect(container).toMatchSnapshot();
  });
});
