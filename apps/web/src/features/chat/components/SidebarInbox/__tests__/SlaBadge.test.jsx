/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/badge.jsx', () => ({
  Badge: ({ children, ...props }) => (
    <span data-slot="badge" data-props={JSON.stringify(props)}>
      {children}
    </span>
  ),
}));

const { SlaBadge, resolveSlaDescriptor } = await import('../SlaBadge.jsx');

describe('resolveSlaDescriptor', () => {
  it('signals when the window is closed', () => {
    const descriptor = resolveSlaDescriptor({ isOpen: false, remainingMinutes: 10 });

    expect(descriptor).toEqual(
      expect.objectContaining({
        label: 'Janela expirada',
        badgeProps: expect.objectContaining({ tone: 'error' }),
      }),
    );
  });

  it('handles indeterminate remaining minutes', () => {
    const descriptor = resolveSlaDescriptor({ isOpen: true, remainingMinutes: null });

    expect(descriptor).toEqual(
      expect.objectContaining({
        label: 'Janela indeterminada',
        badgeProps: expect.objectContaining({ tone: 'info' }),
      }),
    );
  });

  it('highlights critical minutes', () => {
    const descriptor = resolveSlaDescriptor({ isOpen: true, remainingMinutes: 5 });

    expect(descriptor).toEqual(
      expect.objectContaining({
        label: 'Expira em 5 min',
        badgeProps: expect.objectContaining({ tone: 'error' }),
      }),
    );
  });

  it('summarises remaining hours when above one hour', () => {
    const descriptor = resolveSlaDescriptor({ isOpen: true, remainingMinutes: 130 });

    expect(descriptor).toEqual(
      expect.objectContaining({
        label: 'Expira em 2h',
        badgeProps: expect.objectContaining({ tone: 'info' }),
      }),
    );
  });
});

describe('SlaBadge', () => {
  it('renders an error tone when the window is closed', () => {
    render(<SlaBadge window={{ isOpen: false, remainingMinutes: 0 }} />);

    const badge = screen.getByText('Janela expirada');
    expect(badge).toBeInTheDocument();
    const props = JSON.parse(badge.dataset.props);
    expect(props.variant).toBe('status');
    expect(props.tone).toBe('error');
  });

  it('renders an informational tone for long windows', () => {
    render(<SlaBadge window={{ isOpen: true, remainingMinutes: 180 }} />);

    const badge = screen.getByText('Expira em 3h');
    expect(badge).toBeInTheDocument();
    const props = JSON.parse(badge.dataset.props);
    expect(props.variant).toBe('status');
    expect(props.tone).toBe('info');
  });
});
