import { memo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { cn } from '@/lib/utils.js';
import { CartesianGrid, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { TicketSeriesEntry } from '../useDashboardData.ts';

export interface TicketsDailyWidgetProps {
  data: TicketSeriesEntry[];
  loading?: boolean;
  className?: string;
}

const TicketsDailyWidgetComponent = ({ data, loading = false, className }: TicketsDailyWidgetProps) => (
  <Card className={cn('transition-shadow duration-200 hover:shadow-lg', className)}>
    <CardHeader>
      <CardTitle>Tickets por Dia</CardTitle>
      <CardDescription>Acompanhe o volume de tickets abertos, fechados e pendentes</CardDescription>
    </CardHeader>
    <CardContent>
      {loading ? (
        <Skeleton className="h-[300px] w-full rounded-lg" data-testid="tickets-daily-skeleton" />
      ) : (
        <>
          <ResponsiveContainer width="100%" height={300} data-testid="tickets-daily-chart">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="abertos" fill="var(--color-error)" name="Abertos" />
              <Bar dataKey="fechados" fill="var(--color-success)" name="Fechados" />
              <Bar dataKey="pendentes" fill="var(--color-warning)" name="Pendentes" />
            </BarChart>
          </ResponsiveContainer>
          {data.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground" data-testid="tickets-daily-empty">
              Nenhum ticket registrado nos últimos dias.
            </p>
          ) : null}
        </>
      )}
    </CardContent>
  </Card>
);

export const TicketsDailyWidget = memo(TicketsDailyWidgetComponent);
