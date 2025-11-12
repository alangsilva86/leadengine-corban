import {
  MessageSquare,
  Phone,
  Mail,
  Calendar,
  MoreVertical,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Progress } from '@/components/ui/progress.jsx';
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

const getOnboardingProgress = (onboarding) => {
  if (!onboarding?.stages?.length) {
    return {
      currentIndex: 0,
      total: 0,
      progressValue: 0,
      displayIndex: 0,
      nextStage: null,
      isComplete: false,
    };
  }

  const total = onboarding.stages.length;
  const activeStep = typeof onboarding.activeStep === 'number' ? onboarding.activeStep : 0;
  const currentIndex = Math.min(activeStep, total - 1);
  const displayIndex = Math.min(activeStep + 1, total);
  const progressValue = Math.round((displayIndex / total) * 100);
  const hasCampaign = Boolean(onboarding.activeCampaign);
  const isComplete = hasCampaign && currentIndex >= total - 1;
  const nextIndex = Math.min(currentIndex + 1, total - 1);
  const nextStage = isComplete
    ? 'Atenda seus leads na Inbox'
    : onboarding.stages[nextIndex]?.label ?? onboarding.stages[currentIndex]?.label;

  return { currentIndex, total, progressValue, displayIndex, nextStage, isComplete };
};

const heroStyle = {
  background:
    'radial-gradient(circle at top left, color-mix(in srgb, var(--primary) 28%, transparent) 0%, transparent 55%), radial-gradient(circle at bottom right, color-mix(in srgb, var(--success) 22%, transparent) 0%, transparent 60%), color-mix(in srgb, var(--surface-overlay-strong) 78%, transparent)',
  boxShadow: '0 24px 60px color-mix(in srgb, var(--color-border) 45%, transparent)',
};

const Dashboard = ({ onboarding, onStart }) => {
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

  const { total, progressValue, displayIndex, nextStage, isComplete } = getOnboardingProgress(onboarding);
  const stageLabel = nextStage || 'Conclua as etapas';
  const hasStarted = Boolean(onboarding?.selectedAgreement || onboarding?.whatsappStatus !== 'disconnected');
  const primaryCtaLabel = hasStarted ? 'Continuar configuração' : 'Conectar meu primeiro número';

  return (
    <div className="space-y-6">
      <div
        className="grid gap-6 rounded-[24px] border border-secondary p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
        style={heroStyle}
      >
        <div className="grid max-w-xl gap-4">
          <h1 className="text-3xl font-semibold text-foreground">Mudamos a forma de gerar demanda</h1>
          <p className="text-base leading-relaxed text-muted-foreground">
            Conecte o número que já conversa com os clientes, vincule origens comerciais quando necessário e acompanhe a
            performance das campanhas em tempo real neste painel.
          </p>
          {total ? (
            <div className="space-y-2 rounded-2xl border border-surface-overlay-glass-border bg-surface-overlay-quiet p-4">
              <div className="flex items-center justify-between text-xs uppercase tracking-wide text-inbox-foreground-muted">
                <span>Primeira configuração</span>
                <span>
                  {displayIndex} de {total}
                </span>
              </div>
              <Progress value={progressValue} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {isComplete ? 'Tudo pronto:' : 'Próximo passo:'}{' '}
                <span className="font-medium text-foreground">{stageLabel}</span>
              </p>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg" onClick={onStart}>
              <Sparkles className="h-4 w-4" />
              {primaryCtaLabel}
            </Button>
            <Button variant="outline" size="lg">
              <Calendar className="h-4 w-4" />
              Relatório da semana
            </Button>
          </div>
        </div>
        {onboarding?.stages ? (
          <div className="grid min-w-[220px] gap-3 rounded-2xl border border-surface-overlay-glass-border bg-surface-overlay-strong p-4">
            {onboarding.stages.map((stage, index) => {
              const status =
                index < onboarding.activeStep
                  ? 'done'
                  : index === onboarding.activeStep
                  ? 'current'
                  : 'todo';
              const statusClasses = {
                done: 'border-success/40 bg-success/15',
                current: 'border-primary/50 bg-primary/15',
                todo: 'border-surface-overlay-glass-border bg-surface-overlay-quiet',
              };
              const indexClasses = {
                done: 'border-transparent bg-success text-success-strong-foreground',
                current: 'border-transparent bg-primary text-primary-foreground',
                todo: 'border-surface-overlay-glass-border bg-surface-overlay-quiet text-muted-foreground',
              };
              return (
                <div
                  key={stage.id}
                  className={cn(
                    'grid grid-cols-[auto,1fr] items-center gap-3 rounded-lg border p-3 text-sm transition-colors',
                    statusClasses[status]
                  )}
                >
                  <span
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold',
                      indexClasses[status]
                    )}
                  >
                    {index + 1}
                  </span>
                  <div>
                    <span className="block font-medium text-foreground">{stage.label}</span>
                    <span className="block text-xs text-muted-foreground">
                      {status === 'done' ? 'Concluído' : status === 'current' ? 'Próxima etapa' : 'Aguardando'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

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
            <CardTitle>Leads e Conversões</CardTitle>
            <CardDescription>Evolução mensal de leads e taxa de conversão</CardDescription>
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
                    <Line
                      type="monotone"
                      dataKey="conversoes"
                      stroke="var(--color-success)"
                      strokeWidth={2}
                      name="Conversões"
                    />
                  </LineChart>
                </ResponsiveContainer>
                {leadsSeries.every((item) => item.leads === 0 && item.conversoes === 0) ? (
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
