import {
  MessageSquare,
  Phone,
  Mail,
  MoreVertical,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Link } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { cn } from '@/lib/utils.js';
import { useDashboardData } from './dashboard/useDashboardData';
import { DashboardStatsWidget } from './dashboard/widgets/DashboardStatsWidget';
import { TicketsDailyWidget } from './dashboard/widgets/TicketsDailyWidget';
import { ChannelDistributionWidget } from './dashboard/widgets/ChannelDistributionWidget';

const getStatusBadge = (status) => {
  const variants = {
    open: 'destructive',
    pending: 'secondary',
    resolved: 'default',
  };
  return variants[status] || 'secondary';
};

const getPriorityColor = (priority) => {
  const colors = {
    high: 'text-error',
    medium: 'text-warning',
    low: 'text-success',
  };
  return colors[priority] || 'text-muted-foreground';
};

const getChannelIcon = (channel) => {
  const icons = {
    whatsapp: MessageSquare,
    email: Mail,
    phone: Phone,
    chat: MessageSquare,
    sms: MessageSquare,
    social: Sparkles,
    other: MessageSquare,
  };
  const Icon = icons[channel] || MessageSquare;
  return <Icon className="h-4 w-4" />;
};

const Dashboard = () => {
  const {
    stats,
    ticketsSeries,
    leadsSeries,
    channelDistribution,
    recentTickets,
    loading,
    errors,
    refetchAll,
  } = useDashboardData();

  const statsLoading = loading.stats;
  const ticketsChartLoading = loading.ticketsChart;
  const leadsChartLoading = loading.leadsChart;
  const channelLoading = loading.channelDistribution;
  const recentTicketsLoading = loading.recentTickets;

  const handleRetry = () => {
    refetchAll();
  };

  return (
    <div className="min-w-0 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Visão geral da operação</h1>
        <Button asChild><Link to="/inbox">Abrir atendimentos</Link></Button>
      </header>

      {errors.length > 0 ? (
        <Alert variant="destructive" className="border-destructive/40 bg-destructive/10">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Não foi possível carregar todos os dados do painel.</AlertTitle>
          <AlertDescription>
            {errors.map((message, index) => (
              <p key={index}>{message}</p>
            ))}
            <Button size="sm" variant="outline" className="mt-2" onClick={handleRetry}>
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <DashboardStatsWidget stats={stats} loading={statsLoading} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TicketsDailyWidget data={ticketsSeries} loading={ticketsChartLoading} />

        <Card className="transition-shadow duration-200 hover:shadow-lg">
          <CardHeader>
            <CardTitle>Aquisição de leads</CardTitle>
            <CardDescription>Leads cadastrados por mês</CardDescription>
          </CardHeader>
          <CardContent>
            {leadsChartLoading ? (
              <Skeleton className="h-[300px] w-full rounded-lg" />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={leadsSeries}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="leads" stroke="var(--color-chart-2)" strokeWidth={2} name="Leads" />
                  </LineChart>
                </ResponsiveContainer>
                {leadsSeries.every((item) => item.leads === 0) ? (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Ainda não há leads registrados para exibir nesta série temporal.
                  </p>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ChannelDistributionWidget data={channelDistribution} loading={channelLoading} />

        <Card className="transition-shadow duration-200 hover:shadow-lg lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Tickets Recentes</CardTitle>
                <CardDescription>Últimas atividades de atendimento</CardDescription>
              </div>
              <Button variant="ghost" size="sm" disabled={recentTicketsLoading}>
                Ver todos
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentTicketsLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={`recent-ticket-skeleton-${index}`}
                    className="flex animate-pulse items-start justify-between gap-4 rounded-lg border border-border bg-surface-overlay-strong p-4"
                  >
                    <div className="flex-1 space-y-3">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-5 w-40" />
                      <Skeleton className="h-4 w-56" />
                      <div className="flex items-center gap-4">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                    <Skeleton className="h-8 w-8 rounded-full" />
                  </div>
                ))}
              </div>
            ) : recentTickets.length > 0 ? (
              <div className="space-y-4">
                {recentTickets.map((ticket, index) => (
                  <div
                    key={`${ticket.id}-${index}`}
                    className="flex transform items-start justify-between gap-4 rounded-lg border border-border bg-surface-overlay-strong p-4 transition-all duration-200 ease-in-out hover:scale-[1.02] hover:bg-secondary"
                  >
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-mono">{ticket.id}</span>
                        <Badge variant={getStatusBadge(ticket.status)}>{ticket.status}</Badge>
                      </div>
                      <h4 className="text-base font-medium text-foreground">{ticket.customer}</h4>
                      <p className="text-sm text-muted-foreground">{ticket.subject}</p>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          {getChannelIcon(ticket.channel)}
                          <span className="capitalize">{ticket.channel}</span>
                        </div>
                        <span className={cn('font-medium', getPriorityColor(ticket.priority))}>
                          ● {ticket.priority}
                        </span>
                        <span className="ml-auto text-xs">{ticket.time}</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-[var(--radius)] border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Nenhum ticket recente encontrado. Assim que novos atendimentos chegarem, eles aparecerão aqui.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
