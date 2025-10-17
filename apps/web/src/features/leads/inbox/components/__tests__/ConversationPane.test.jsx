/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import ConversationPane from '../ConversationPane.jsx';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../LeadConversationPanel.jsx', () => ({
  __esModule: true,
  default: ({ allocation, onOpenWhatsApp, isLoading, isSwitching }) => (
    <div
      data-testid="lead-conversation-panel"
      data-allocation={allocation?.allocationId ?? ''}
      data-loading={isLoading ? 'yes' : 'no'}
      data-switching={isSwitching ? 'yes' : 'no'}
    >
      {typeof onOpenWhatsApp === 'function' ? 'has-callback' : 'no-callback'}
    </div>
  ),
}));

describe('ConversationPane', () => {
  it('forwards props to LeadConversationPanel', () => {
    const allocation = { allocationId: 'alloc-123' };
    const onOpenWhatsApp = vi.fn();

    render(
      <ConversationPane
        allocation={allocation}
        onOpenWhatsApp={onOpenWhatsApp}
        isLoading
        isSwitching
      />
    );

    const panel = screen.getByTestId('lead-conversation-panel');
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveAttribute('data-allocation', 'alloc-123');
    expect(panel).toHaveAttribute('data-loading', 'yes');
    expect(panel).toHaveAttribute('data-switching', 'yes');
    expect(panel).toHaveTextContent('has-callback');
  });
});
