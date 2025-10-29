/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.mock('recharts', () => {
  const MockContainer = ({ children, ...props }: { children?: ReactNode }) => (
    <div {...props}>{children}</div>
  );
  const MockElement = ({ children, ...props }: { children?: ReactNode }) => <div {...props}>{children}</div>;

  return {
    ResponsiveContainer: MockContainer,
    BarChart: MockElement,
    Bar: MockElement,
    CartesianGrid: MockElement,
    XAxis: MockElement,
    YAxis: MockElement,
    Tooltip: MockElement,
  };
});

import { TicketsDailyWidget } from '../TicketsDailyWidget';
import type { TicketSeriesEntry } from '../../useDashboardData';

afterEach(() => {
  cleanup();
});

describe('TicketsDailyWidget', () => {
  it('renders skeleton while loading', () => {
    render(<TicketsDailyWidget data={[]} loading />);
    expect(screen.getByTestId('tickets-daily-skeleton')).toBeInTheDocument();
  });

  it('shows empty state when there is no data', () => {
    render(<TicketsDailyWidget data={[]} loading={false} />);
    expect(screen.getByTestId('tickets-daily-empty')).toBeInTheDocument();
  });

  it('renders chart when data is available', () => {
    const data: TicketSeriesEntry[] = [
      { name: 'Seg', abertos: 5, pendentes: 2, fechados: 3 },
      { name: 'Ter', abertos: 3, pendentes: 1, fechados: 4 },
    ];

    render(<TicketsDailyWidget data={data} loading={false} />);
    expect(screen.getByTestId('tickets-daily-chart')).toBeInTheDocument();
    expect(screen.queryByTestId('tickets-daily-empty')).not.toBeInTheDocument();
  });
});
