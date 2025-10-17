/** @vitest-environment jsdom */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

import Reports from '../Reports.jsx';

const createResizeObserverMock = () =>
  class ResizeObserver {
    constructor(callback) {
      this.callback = callback;
    }

    observe(element) {
      this.callback?.([
        { target: element, contentRect: element.getBoundingClientRect?.() ?? { width: 0, height: 0 } },
      ]);
    }

    unobserve() {}

    disconnect() {}
  };

describe('Reports convenios tab', () => {
  beforeEach(() => {
    global.ResizeObserver = createResizeObserverMock();
    if (!SVGElement.prototype.getBBox) {
      // Recharts usa getBBox em elementos SVG durante os cálculos de layout
      SVGElement.prototype.getBBox = () => ({ width: 0, height: 0, x: 0, y: 0 });
    }
  });

  afterEach(() => {
    cleanup();
  });

  it('exibe skeleton de carregamento antes de mostrar os dados', () => {
    render(<Reports />);

    expect(screen.queryByRole('button', { name: /filtros/i })).not.toBeInTheDocument();
    expect(screen.getAllByText(/relatórios e insights/i)).toHaveLength(1);
  });

  it('renderiza métricas e tabela de convênios após o carregamento', async () => {
    render(<Reports />);

    expect(await screen.findByRole('button', { name: /filtros/i }, { timeout: 2000 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /exportar/i })).toBeInTheDocument();

    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(5); // header + 4 convênios

    const goianiaRow = rows[1];
    expect(within(goianiaRow).getByText('SAEC Goiânia')).toBeInTheDocument();
    expect(within(goianiaRow).getByText('156')).toBeInTheDocument();
    expect(within(goianiaRow).getByText('23')).toBeInTheDocument();
    expect(within(goianiaRow).getByText('14.7%')).toHaveClass('textSuccess');
    expect(within(goianiaRow).getByText('R$ 34.500')).toBeInTheDocument();

    const londrinaRow = rows[3];
    expect(within(londrinaRow).getByText('11.9%')).toHaveClass('text-yellow-600');
    expect(within(londrinaRow).getByText('R$ 12.000')).toBeInTheDocument();
  });

  it('permite alternar o período exibido', async () => {
    render(<Reports />);
    await screen.findByRole('button', { name: /filtros/i }, { timeout: 2000 });

    const sevenDays = await screen.findByRole('button', { name: /7 dias/i });
    const thirtyDays = screen.getByRole('button', { name: /30 dias/i });

    expect(sevenDays.className).toMatch(/bg-primary/);
    expect(thirtyDays.className).toMatch(/border/);

    await userEvent.click(thirtyDays);

    expect(thirtyDays.className).toMatch(/bg-primary/);
    expect(sevenDays.className).toMatch(/border/);
  });
});
