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
    PieChart: MockElement,
    Pie: MockElement,
    Cell: ({ children, ...props }: { children?: React.ReactNode }) => <div {...props}>{children}</div>,
    Tooltip: MockElement,
  };
});

import { ChannelDistributionWidget } from '../ChannelDistributionWidget.tsx';
import type { ChannelDistributionEntry } from '../../useDashboardData.ts';

afterEach(() => {
  cleanup();
});

describe('ChannelDistributionWidget', () => {
  it('renders skeleton while loading', () => {
    render(<ChannelDistributionWidget data={[]} loading />);
    expect(screen.getByTestId('channel-distribution-skeleton')).toBeInTheDocument();
  });

  it('shows empty state when there is no data', () => {
    render(<ChannelDistributionWidget data={[]} loading={false} />);
    expect(screen.getByTestId('channel-distribution-empty')).toBeInTheDocument();
  });

  it('renders chart and rows when data is available', () => {
    const data: ChannelDistributionEntry[] = [
      { name: 'WhatsApp', value: 60, color: '#25D366' },
      { name: 'Email', value: 40, color: '#1E88E5' },
    ];

    render(<ChannelDistributionWidget data={data} loading={false} />);
    expect(screen.getByTestId('channel-distribution-chart')).toBeInTheDocument();
    expect(screen.getAllByTestId('channel-distribution-row')).toHaveLength(data.length);
  });
});
