/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import EventCard from '../EventCard.jsx';

const buildEntry = (overrides = {}) => ({
  id: 'event-1',
  type: 'event',
  date: new Date('2024-02-01T12:00:00.000Z'),
  payload: {
    label: 'Evento genérico',
    description: 'Descrição do evento',
  },
  ...overrides,
});

describe('EventCard', () => {
  it('resume simulações/vendas em texto legível, sem JSON', () => {
    const entry = buildEntry({
      type: 'deal',
      payload: {
        label: 'Venda registrada',
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

    expect(screen.getByText('Venda registrada')).toBeInTheDocument();
    expect(screen.getByText(/Banco Teste · 24x de R\$\s?250,00 · líquido R\$\s?1\.000,00/)).toBeInTheDocument();
    expect(screen.queryByText(/Ver detalhes avançados/)).not.toBeInTheDocument();
    expect(screen.queryByText(/"origin"/)).not.toBeInTheDocument();
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
    expect(screen.getByText(/Conteúdo do evento/)).toBeInTheDocument();
  });
});
