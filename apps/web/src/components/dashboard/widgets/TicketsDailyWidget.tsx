import { memo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { cn } from '@/lib/utils.js';
import { CartesianGrid, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { TicketSeriesEntry } from '../useDashboardData';
import { chartAxis, chartGrid, chartLegend, chartTooltip } from './chart-theme';

export interface TicketsDailyWidgetProps {
  data: TicketSeriesEntry[];
  loading?: boolean;
  className?: string;
}

const TicketsDailyWidgetComponent = ({ data, loading = false, className }: TicketsDailyWidgetProps) => (
  <Card className={cn('gap-4', className)}>
    <CardHeader>
      <CardTitle>Conversas por dia</CardTitle>
      <CardDescription>Abertas, pendentes e encerradas nos últimos 7 dias.</CardDescription>
    </CardHeader>
    <CardContent>
      {loading ? (
        <Skeleton className="h-[280px] w-full rounded-lg" data-testid="tickets-daily-skeleton" />
      ) : (
        <>
          <ResponsiveContainer width="100%" height={280} data-testid="tickets-daily-chart">
            <BarChart data={data} barGap={2}>
              <CartesianGrid {...chartGrid} />
              <XAxis dataKey="name" {...chartAxis} />
              <YAxis allowDecimals={false} width={32} {...chartAxis} />
              <Tooltip {...chartTooltip} />
              <Legend {...chartLegend} />
              <Bar dataKey="abertos" stackId="conversas" fill="var(--color-chart-1)" name="Abertas" radius={[0, 0, 0, 0]} />
              <Bar dataKey="pendentes" stackId="conversas" fill="var(--color-chart-5)" name="Pendentes" />
              <Bar dataKey="fechados" stackId="conversas" fill="var(--color-chart-4)" name="Encerradas" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          {data.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground" data-testid="tickets-daily-empty">
              Nenhuma conversa nos últimos dias.
            </p>
          ) : null}
        </>
      )}
    </CardContent>
  </Card>
);

export const TicketsDailyWidget = memo(TicketsDailyWidgetComponent);
