/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { forwardRef } from 'react';

import InboxListPane from '../InboxListPane.jsx';

vi.mock('../InboxList.jsx', () => ({
  default: forwardRef(({ className }, ref) => (
    <div ref={ref} data-testid="inbox-list" className={className}>
      inbox list mock
    </div>
  )),
}));

vi.mock('../GlobalFiltersBar.jsx', () => ({
  default: () => <div data-testid="filters">filters</div>,
}));

vi.mock('@/components/ui/notice-banner.jsx', () => ({
  default: ({ children, ...rest }) => (
    <div data-testid="notice" {...rest}>
      {children}
    </div>
  ),
}));

describe('InboxListPane', () => {
  const baseListProps = {
    allocations: [],
    filteredAllocations: [],
    loading: false,
    selectedAgreement: null,
    campaign: null,
    onBackToWhatsApp: vi.fn(),
    onSelectAgreement: vi.fn(),
    onSelectAllocation: vi.fn(),
    activeAllocationId: null,
    onOpenWhatsApp: vi.fn(),
  };

  const baseNotices = {
    showRealtimeConnecting: false,
    showRealtimeError: false,
    showErrorNotice: false,
    showWarningNotice: false,
    connectionError: null,
    error: null,
    warningMessage: null,
  };

  it('registers scroll viewport and renders list', () => {
    const registerScrollViewport = vi.fn();
    const ref = { current: null };

    render(
      <InboxListPane
        ref={ref}
        filters={{ status: 'all' }}
        onUpdateFilters={vi.fn()}
        onResetFilters={vi.fn()}
        queueOptions={[]}
        windowOptions={[]}
        savedViews={[]}
        activeViewId={null}
        onSelectSavedView={vi.fn()}
        onSaveCurrentView={vi.fn()}
        onDeleteSavedView={vi.fn()}
        canSaveView={false}
        viewLimit={5}
        registerScrollViewport={registerScrollViewport}
        scrollParent={null}
        listProps={baseListProps}
        notices={baseNotices}
      />
    );

    expect(screen.getByTestId('inbox-list')).toBeInTheDocument();
    expect(registerScrollViewport).toHaveBeenCalled();
  });

  it('renders notice banners when flags are enabled', () => {
    render(
      <InboxListPane
        ref={{ current: null }}
        filters={{ status: 'all' }}
        onUpdateFilters={vi.fn()}
        onResetFilters={vi.fn()}
        queueOptions={[]}
        windowOptions={[]}
        savedViews={[]}
        activeViewId={null}
        onSelectSavedView={vi.fn()}
        onSaveCurrentView={vi.fn()}
        onDeleteSavedView={vi.fn()}
        canSaveView={false}
        viewLimit={5}
        registerScrollViewport={vi.fn()}
        scrollParent={null}
        listProps={baseListProps}
        notices={{
          showRealtimeConnecting: true,
          showRealtimeError: true,
          showErrorNotice: true,
          showWarningNotice: true,
          connectionError: 'offline',
          error: 'Erro',
          warningMessage: 'Atenção',
        }}
      />
    );

    const notices = screen.getAllByTestId('notice');
    expect(notices.length).toBeGreaterThanOrEqual(4);
    expect(screen.getByText(/Tempo real indisponível/i)).toBeInTheDocument();
    expect(screen.getByText(/Erro/)).toBeInTheDocument();
    expect(screen.getByText(/Atenção/)).toBeInTheDocument();
  });
});
