/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MessageSquare, Users } from 'lucide-react';
import { DashboardStatsWidget } from '../DashboardStatsWidget';
import type { DashboardStat } from '../../useDashboardData';

afterEach(() => {
  cleanup();
});

describe('DashboardStatsWidget', () => {
  it('renders loading skeletons when loading', () => {
    const { container } = render(<DashboardStatsWidget stats={[]} loading />);
    const skeletons = container.querySelectorAll('[data-testid="dashboard-stat-skeleton"]');
    expect(skeletons).toHaveLength(4);
  });

  it('renders stats cards when data is provided', () => {
    const stats: DashboardStat[] = [
      {
        id: 'tickets',
        title: 'Tickets Ativos',
        value: '120',
        change: '+10%',
        trend: 'up',
        icon: MessageSquare,
        color: 'blue',
      },
      {
        id: 'leads',
        title: 'Leads Novos',
        value: '85',
        change: '—',
        trend: 'neutral',
        icon: Users,
        color: 'green',
      },
    ];

    const { container } = render(<DashboardStatsWidget stats={stats} />);

    expect(container.querySelectorAll('[data-testid="dashboard-stat-card"]')).toHaveLength(stats.length);
    expect(screen.getByText('Tickets Ativos')).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getByText('+10%')).toBeInTheDocument();
    expect(screen.getByText('Leads Novos')).toBeInTheDocument();
    expect(screen.getByText('85')).toBeInTheDocument();
  });
});
