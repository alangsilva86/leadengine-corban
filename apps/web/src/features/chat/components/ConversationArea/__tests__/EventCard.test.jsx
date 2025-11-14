/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import EventCard from '../EventCard.jsx';

const buildEntry = (overrides = {}) => ({
  id: 'event-1',
  type: 'event',
  date: '2024-02-01T12:00:00.000Z',
  payload: {
    label: 'Evento genérico',
    description: 'Descrição do evento',
  },
  ...overrides,
});

describe('EventCard', () => {
  it('renders sales-specific metadata when available', () => {
    const entry = buildEntry({
      type: 'deal',
      payload: {
        label: 'Negócio registrado',
        stageKey: 'APROVADO_LIQUIDACAO',
        calculationSnapshot: {
          type: 'deal',
          bank: { label: 'Banco Teste' },
          term: 24,
          installment: 250,
          netAmount: 1000,
        },
        metadata: { origin: 'chat' },
      },
    });

    render(<EventCard entry={entry} />);

    expect(screen.getByText('Negócio registrado')).toBeInTheDocument();
    const stageChip = screen.getByText('Aprovado/Liquidação');
    expect(stageChip.closest('[data-stage-key]')).toHaveAttribute('data-stage-key', 'APROVADO_LIQUIDACAO');
    expect(screen.getByText(/Banco Teste/)).toBeInTheDocument();
    expect(screen.getByText(/parcela/)).toBeInTheDocument();
    expect(screen.getByText(/Ver detalhes avançados/)).toBeInTheDocument();
  });

  it('falls back to a generic rendering for unknown types', () => {
    const entry = buildEntry({
      type: 'custom',
      payload: {
        label: 'Atualização especial',
        description: 'Conteúdo do evento',
      },
    });

    render(<EventCard entry={entry} />);

    expect(screen.getByText('Atualização especial')).toBeInTheDocument();
    expect(screen.queryByText('Snapshot de cálculo')).not.toBeInTheDocument();
  });
});
