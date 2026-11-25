/* @vitest-environment jsdom */
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ConversationHeader from '../ConversationHeader.jsx';

const identityRenders = vi.fn();

vi.mock('../header/HeaderIdentity.jsx', () => ({
  __esModule: true,
  default: () => {
    identityRenders();
    return null;
  },
}));

vi.mock('@/features/chat/hooks/useInstancePresentation.js', () => ({
  __esModule: true,
  default: () => ({ label: 'Instância mock', color: '#94A3B8', phone: null, number: null }),
}));

describe('ConversationHeader — relógio do prazo interno', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
    identityRenders.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('não re-renderiza o cabeçalho a cada segundo (só o chip de tempo)', () => {
    const startedAt = new Date('2024-01-01T00:00:00.000Z');
    const ticket = {
      id: 'ticket-1',
      status: 'OPEN',
      contact: { name: 'Cliente Teste', id: 'contact-1' },
      metadata: { internalSla: { startedAt, deadline: new Date(startedAt.getTime() + 30 * 60 * 1000), windowMinutes: 30 } },
    };

    const { getByText } = render(<ConversationHeader ticket={ticket} onAssign={() => {}} />);
    const rendersAfterMount = identityRenders.mock.calls.length;

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(identityRenders.mock.calls.length).toBe(rendersAfterMount);
    expect(getByText('Responder em 30 min')).toBeDefined();
  });
});
