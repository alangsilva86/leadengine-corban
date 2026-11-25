/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import TicketTimeChip from '../header/TicketTimeChip.jsx';
import HeaderStatus from '../header/HeaderStatus.jsx';

const HALF_HOUR_IN_MS = 30 * 60 * 1000;

describe('TicketTimeChip', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('mostra o prazo interno e o atualiza com o próprio relógio', () => {
    const startedAt = new Date('2024-01-01T00:00:00.000Z');
    vi.setSystemTime(startedAt);
    const ticket = {
      metadata: { internalSla: { startedAt, deadline: new Date(startedAt.getTime() + HALF_HOUR_IN_MS), windowMs: HALF_HOUR_IN_MS } },
    };

    render(<HeaderStatus time={<TicketTimeChip ticket={ticket} />} />);
    expect(screen.getByText('Responder em 30 min')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(HALF_HOUR_IN_MS + 2 * 60 * 1000);
    });
    expect(screen.getByText('Atrasada há 2 min')).toBeInTheDocument();
  });

  it('usa a janela de 24 h ou a espera quando não há prazo interno', () => {
    const { rerender } = render(<TicketTimeChip ticket={{}} windowState={{ state: 'closing', shortLabel: 'Janela fecha em 3 h' }} />);
    expect(screen.getByText('Janela fecha em 3 h')).toBeInTheDocument();

    rerender(<TicketTimeChip ticket={{}} waiting={{ overdue: true, label: 'Aguardando há 40 min' }} />);
    expect(screen.getByText('Aguardando há 40 min')).toBeInTheDocument();
  });

  it('não renderiza nada sem informação útil', () => {
    const { container } = render(<TicketTimeChip ticket={{}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
