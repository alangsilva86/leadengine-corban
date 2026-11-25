import { memo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { cn } from '@/lib/utils.js';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import type { ChannelDistributionEntry } from '../useDashboardData';
import { chartTooltip } from './chart-theme';

export interface ChannelDistributionWidgetProps {
  data: ChannelDistributionEntry[];
  loading?: boolean;
  className?: string;
}

const ChannelDistributionWidgetComponent = ({ data, loading = false, className }: ChannelDistributionWidgetProps) => (
  <Card className={cn('gap-4 lg:col-span-1', className)}>
    <CardHeader>
      <CardTitle>Conversas por canal</CardTitle>
      <CardDescription>De onde vêm as conversas.</CardDescription>
    </CardHeader>
    <CardContent>
      {loading ? (
        <Skeleton className="h-[240px] w-full rounded-lg" data-testid="channel-distribution-skeleton" />
      ) : data.length > 0 ? (
        <>
          <div className="mb-4">
            <ResponsiveContainer width="100%" height={200} data-testid="channel-distribution-chart">
              <PieChart>
                <Pie data={data} cx="50%" cy="50%" innerRadius={40} outerRadius={80} paddingAngle={5} dataKey="value">
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number | string) => `${value}%`} {...chartTooltip} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2">
            {data.map((channel) => (
              <div
                key={channel.name}
                className="flex items-center justify-between text-sm text-muted-foreground"
                data-testid="channel-distribution-row"
              >
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: channel.color }} />
                  <span className="text-foreground">{channel.name}</span>
                </div>
                <span className="font-medium tabular-nums">{channel.value}%</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground" data-testid="channel-distribution-empty">
          Ainda não há conversas suficientes para mostrar a distribuição.
        </p>
      )}
    </CardContent>
  </Card>
);

export const ChannelDistributionWidget = memo(ChannelDistributionWidgetComponent);
