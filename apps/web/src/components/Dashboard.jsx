import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Inbox, MessageSquare, Phone, Mail, Smartphone, Sparkles } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { PageHeader } from '@/components/page/PageHeader.jsx';
import { EmptyState } from '@/components/page/EmptyState.jsx';
import { ErrorState } from '@/components/page/ErrorState.jsx';
import { cn } from '@/lib/utils.js';
import { useAuth } from '@/features/auth/AuthProvider.jsx';
import { canAccessPage } from '@/features/navigation/routes.ts';
import { useInstancesStore } from '@/features/whatsapp/state/store/index.ts';
import { resolveNormalizedInstanceStatus } from '@/features/whatsapp/lib/instances.ts';
import { useDashboardData } from './dashboard/useDashboardData';
import { DashboardStatsWidget } from './dashboard/widgets/DashboardStatsWidget';
import { TicketsDailyWidget } from './dashboard/widgets/TicketsDailyWidget';
import { ChannelDistributionWidget } from './dashboard/widgets/ChannelDistributionWidget';
import { chartAxis, chartGrid, chartTooltip } from './dashboard/widgets/chart-theme';

const STATUS_LABELS = { open: 'Aberta', pending: 'Pendente', resolved: 'Encerrada' };
const STATUS_STYLES = {
  open: 'bg-primary-soft text-primary-soft-foreground',
  pending: 'bg-warning-soft text-warning-soft-foreground',
  resolved: 'bg-surface-sunken text-muted-foreground',
};
const PRIORITY_LABELS = { high: 'Prioridade alta', medium: null, low: null };
const CHANNEL_ICONS = { whatsapp: MessageSquare, email: Mail, phone: Phone, chat: MessageSquare, sms: MessageSquare, social: Sparkles };
const CHANNEL_LABELS = { whatsapp: 'WhatsApp', email: 'E-mail', phone: 'Telefone', chat: 'Chat', sms: 'SMS', social: 'Redes sociais', other: 'Outro' };

/** Aviso de configuração real (sem passo a passo falso): só aparece enquanto não há número conectado. */
const SetupCallout = () => {
  const instances = useInstancesStore((state) => state.instances);
  const ready = useInstancesStore((state) => state.instancesReady);
  const connected = useMemo(
    () => (Array.isArray(instances) ? instances : []).filter((item) => resolveNormalizedInstanceStatus(item) === 'connected').length,
    [instances],
  );
  if (!ready || connected > 0) return null;
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-primary-soft-border bg-primary-soft p-5 sm:flex-row sm:items-center">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Smartphone className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">Conecte um número de WhatsApp para começar</p>
        <p className="text-sm text-muted-foreground">
          As conversas dos seus clientes chegam ao Inbox assim que um número estiver conectado. Leva cerca de 2 minutos.
        </p>
      </div>
      <Button asChild>
        <Link to="/channels">Conectar número</Link>
      </Button>
    </div>
  );
};

const Dashboard = () => {
  const { user } = useAuth();
  const { stats, ticketsSeries, leadsSeries, channelDistribution, recentTickets, loading, errors, refetchAll } =
    useDashboardData();
  const firstName = typeof user?.name === 'string' ? user.name.trim().split(/\s+/)[0] : null;
  const hasLeadData = leadsSeries.some((item) => item.leads > 0);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        title="Visão geral da operação"
        documentTitle="Visão geral"
        description={firstName ? `Olá, ${firstName}. Veja como está o atendimento hoje.` : 'Veja como está o atendimento hoje.'}
        actions={
          <Button asChild>
            <Link to="/inbox">
              <Inbox aria-hidden="true" />
              Abrir Inbox
            </Link>
          </Button>
        }
      />

      {canAccessPage('channels', user?.role) ? <SetupCallout /> : null}

      {errors.length > 0 ? (
        <Card className="py-0">
          <ErrorState
            size="compact"
            title="Parte dos indicadores não carregou"
            error={{ message: errors[0] }}
            onRetry={refetchAll}
          />
        </Card>
      ) : null}

      <DashboardStatsWidget stats={stats} loading={loading.stats} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TicketsDailyWidget data={ticketsSeries} loading={loading.ticketsChart} />

        <Card className="gap-4">
          <CardHeader>
            <CardTitle>Novos leads por mês</CardTitle>
            <CardDescription>Contatos que entraram no funil nos últimos 6 meses.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading.leadsChart ? (
              <Skeleton className="h-[280px] w-full rounded-lg" />
            ) : hasLeadData ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={leadsSeries}>
                  <CartesianGrid {...chartGrid} />
                  <XAxis dataKey="name" {...chartAxis} />
                  <YAxis allowDecimals={false} width={32} {...chartAxis} />
                  <Tooltip {...chartTooltip} />
                  <Bar dataKey="leads" fill="var(--color-chart-1)" name="Leads" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                size="compact"
                title="Nenhum lead nos últimos meses"
                description="Os leads aparecem aqui assim que chegam pelo WhatsApp ou são cadastrados no CRM."
                className="h-[280px]"
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ChannelDistributionWidget data={channelDistribution} loading={loading.channelDistribution} />

        <Card className="gap-4 lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div className="space-y-1.5">
              <CardTitle>Conversas recentes</CardTitle>
              <CardDescription>As últimas conversas que tiveram movimento.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/inbox">
                Ver todas
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loading.recentTickets ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-14 w-full rounded-md" />
                ))}
              </div>
            ) : recentTickets.length > 0 ? (
              <ul className="-mx-2 divide-y divide-border">
                {recentTickets.slice(0, 6).map((ticket, index) => {
                  const ChannelIcon = CHANNEL_ICONS[ticket.channel] ?? MessageSquare;
                  const priorityLabel = PRIORITY_LABELS[ticket.priority];
                  return (
                    <li key={`${ticket.id}-${index}`}>
                      <Link
                        to="/inbox"
                        className="flex items-center gap-3 rounded-md px-2 py-3 transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-muted-foreground">
                          <ChannelIcon className="size-4" aria-hidden="true" />
                          <span className="sr-only">{CHANNEL_LABELS[ticket.channel] ?? 'Canal'}</span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">{ticket.customer}</span>
                          <span className="block truncate text-sm text-muted-foreground">{ticket.subject}</span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          <span className="text-xs text-muted-foreground tabular-nums">{ticket.time}</span>
                          <span className="flex items-center gap-1.5">
                            {priorityLabel ? (
                              <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger-soft-foreground">
                                {priorityLabel}
                              </span>
                            ) : null}
                            <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_STYLES[ticket.status])}>
                              {STATUS_LABELS[ticket.status] ?? 'Aberta'}
                            </span>
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState
                size="compact"
                icon={Inbox}
                title="Nenhuma conversa ainda"
                description="Assim que clientes mandarem mensagem, as conversas aparecem aqui."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
