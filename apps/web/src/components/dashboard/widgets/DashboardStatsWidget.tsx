import { memo } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { cn } from '@/lib/utils.js';
import type { DashboardStat } from '../useDashboardData';

const trendStyles: Record<string, string> = {
  up: 'text-success-soft-foreground',
  down: 'text-danger-soft-foreground',
  neutral: 'text-muted-foreground',
};

export interface DashboardStatsWidgetProps {
  stats: DashboardStat[];
  loading?: boolean;
  className?: string;
}

const hasDelta = (change: string | null | undefined) => Boolean(change && change !== '—');

/** Indicadores-chave. A variação só aparece quando existe base de comparação (nada de "—" decorativo). */
const DashboardStatsWidgetComponent = ({ stats, loading = false, className }: DashboardStatsWidgetProps) => (
  <div className={cn('grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4', className)}>
    {loading
      ? Array.from({ length: 4 }).map((_, index) => (
          <div
            key={`stat-skeleton-${index}`}
            className="rounded-lg border border-border bg-card p-5 shadow-xs"
            data-testid="dashboard-stat-skeleton"
          >
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-3 h-8 w-20" />
          </div>
        ))
      : stats.map((stat) => (
          <div
            key={stat.id}
            className="rounded-lg border border-border bg-card p-5 shadow-xs"
            data-testid="dashboard-stat-card"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
              <stat.icon className="size-4 text-subtle-foreground" aria-hidden="true" />
            </div>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground tabular-nums">{stat.value}</p>
            {hasDelta(stat.change) ? (
              <p className={cn('mt-1 flex items-center gap-1 text-xs font-medium', trendStyles[stat.trend] ?? trendStyles.neutral)}>
                {stat.trend === 'up' ? <ArrowUpRight className="size-3.5" aria-hidden="true" /> : null}
                {stat.trend === 'down' ? <ArrowDownRight className="size-3.5" aria-hidden="true" /> : null}
                {stat.change}
              </p>
            ) : null}
          </div>
        ))}
  </div>
);

export const DashboardStatsWidget = memo(DashboardStatsWidgetComponent);
