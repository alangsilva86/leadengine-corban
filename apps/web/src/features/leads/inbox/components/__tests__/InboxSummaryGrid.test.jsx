/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { InboxSummaryGrid, statusMetrics } from '../InboxSummaryGrid.jsx';

const baseSummary = {
  total: 12,
  contacted: 4,
  won: 2,
  lost: 1,
};

describe('InboxSummaryGrid', () => {
  it('renderiza o resumo padrão com métricas conhecidas', () => {
    render(<InboxSummaryGrid summary={baseSummary} />);

    statusMetrics.forEach(({ label }) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
    expect(screen.getByText(baseSummary.total)).toBeInTheDocument();
  });

  it('mantém a grade estável quando novas métricas são adicionadas', () => {
    const customMetrics = [
      ...statusMetrics,
      { key: 'followUp', label: 'Em acompanhamento' },
      { key: 'archived', label: 'Arquivados' },
    ];
    const summary = {
      ...baseSummary,
      followUp: 5,
      archived: 3,
    };

    const { container } = render(<InboxSummaryGrid summary={summary} metrics={customMetrics} />);

    customMetrics.forEach(({ label }) => {
      expect(screen.queryAllByText(label)).not.toHaveLength(0);
    });

    const tiles = container.querySelectorAll('dd');
    expect(tiles).toHaveLength(customMetrics.length);

    const grid = container.querySelector('dl');
    expect(grid).toHaveClass('grid-cols-2');
  });
});
