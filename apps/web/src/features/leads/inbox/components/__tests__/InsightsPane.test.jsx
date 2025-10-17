/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React, { forwardRef } from 'react';

import InsightsPane from '../InsightsPane.jsx';

vi.mock('../shared/InboxSurface.jsx', () => ({
  InboxSurface: ({ children }) => <div data-testid="surface">{children}</div>,
}));

vi.mock('../InboxSummaryGrid.jsx', () => ({
  __esModule: true,
  default: ({ summary }) => (
    <div data-testid="summary-grid">{summary.total ?? 0}</div>
  ),
  statusMetrics: [
    { key: 'total', label: 'Total', accent: '', icon: null },
  ],
  formatSummaryValue: (value) => value ?? 0,
}));

vi.mock('../LeadProfilePanel.jsx', () => ({
  __esModule: true,
  default: ({ allocation }) => <div data-testid="lead-profile">{allocation?.id ?? 'none'}</div>,
}));

vi.mock('../ManualConversationCard.jsx', () => ({
  __esModule: true,
  default: forwardRef(({ className }, ref) => (
    <button ref={ref} data-testid="manual-card" type="button" className={className}>
      manual-card
    </button>
  )),
}));

vi.mock('../InboxActions.jsx', () => ({
  __esModule: true,
  default: ({ onRefresh }) => (
    <button data-testid="actions" type="button" onClick={onRefresh}>
      actions
    </button>
  ),
}));

describe('InsightsPane', () => {
  it('renders insights cards and triggers actions', () => {
    const onRefresh = vi.fn();

    render(
      <InsightsPane
        summary={{ total: 42 }}
        activeAllocation={{ id: 'alloc-1' }}
        onUpdateAllocationStatus={vi.fn()}
        onOpenWhatsApp={vi.fn()}
        leadPanelSwitching={false}
        manualConversationCardRef={{ current: null }}
        manualConversationPending={false}
        onManualConversationSubmit={vi.fn()}
        onManualConversationSuccess={vi.fn()}
        rateLimitInfo={null}
        autoRefreshSeconds={null}
        lastUpdatedAt={null}
        loading={false}
        onRefresh={onRefresh}
        onExport={vi.fn()}
        onStartManualConversation={vi.fn()}
      />
    );

    expect(screen.getByText('Resumo')).toBeInTheDocument();
    expect(screen.getByTestId('summary-grid')).toHaveTextContent('42');
    expect(screen.getByTestId('lead-profile')).toHaveTextContent('alloc-1');

    screen.getByTestId('actions').click();
    expect(onRefresh).toHaveBeenCalled();
  });
});
