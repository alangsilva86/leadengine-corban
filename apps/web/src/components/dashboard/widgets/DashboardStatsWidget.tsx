import { memo } from 'react';
import { Card, CardContent } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { cn } from '@/lib/utils.js';
import type { DashboardStat } from '../useDashboardData';

const changeBadgeVariants: Record<string, string> = {
  up: 'bg-success/15 text-success-strong-foreground',
  down: 'bg-error/15 text-error-soft-foreground',
  neutral: 'bg-muted text-muted-foreground',
};

const statIconStyles: Record<DashboardStat['color'], string> = {
  blue: 'bg-primary/15 text-primary',
  green: 'bg-success/15 text-success',
  purple: 'bg-accent text-accent-foreground',
  orange: 'bg-warning/15 text-warning',
};

export interface DashboardStatsWidgetProps {
  stats: DashboardStat[];
  loading?: boolean;
  className?: string;
}

const DashboardStatsWidgetComponent = ({ stats, loading = false, className }: DashboardStatsWidgetProps) => (
  <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4', className)}>
    {loading
      ? Array.from({ length: 4 }).map((_, index) => (
          <Card
            key={`stat-skeleton-${index}`}
            className="transition-shadow duration-200 hover:shadow-lg"
            data-testid="dashboard-stat-skeleton"
          >
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center justify-between">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-7 w-24" />
                <Skeleton className="h-4 w-32" />
              </div>
            </CardContent>
          </Card>
        ))
      : stats.map((stat) => (
          <Card
            key={stat.id}
            className="transition-shadow duration-200 hover:shadow-lg"
            data-testid="dashboard-stat-card"
          >
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center justify-between">
                <div className={cn('flex items-center justify-center rounded-lg p-2', statIconStyles[stat.color])}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <Badge className={changeBadgeVariants[stat.trend] ?? changeBadgeVariants.neutral}>{stat.change}</Badge>
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-semibold text-foreground">{stat.value}</h3>
                <p className="text-sm text-muted-foreground">{stat.title}</p>
              </div>
            </CardContent>
          </Card>
        ))}
  </div>
);

export const DashboardStatsWidget = memo(DashboardStatsWidgetComponent);
