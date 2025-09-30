import { useMemo } from 'react';
import {
  Ticket,
  Users,
  MessageSquare,
  TrendingUp,
  Phone,
  Mail,
  Calendar,
  MoreVertical,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNowStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Progress } from '@/components/ui/progress.jsx';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { apiGet } from '@/lib/api.js';
import { cn } from '@/lib/utils.js';

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' });
const MONTH_FORMATTER = new Intl.DateTimeFormat('pt-BR', { month: 'short' });
const NUMBER_FORMATTER = new Intl.NumberFormat('pt-BR');
const MS_IN_DAY = 24 * 60 * 60 * 1000;

const channelLabels = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  phone: 'Telefone',
  voice: 'URA/Voice',
  chat: 'Chat',
  sms: 'SMS',
  social: 'Redes sociais',
  other: 'Outros',
};

const channelColors = {
  whatsapp: '#25D366',
  email: '#EA4335',
  phone: '#4285F4',
  voice: '#22c55e',
  chat: '#9333EA',
  sms: '#f97316',
  social: '#f472b6',
  other: '#64748b',
};

const changeBadgeVariants = {
  up: 'bg-emerald-500/15 text-emerald-300',
  down: 'bg-rose-500/15 text-rose-300',
  neutral: 'bg-slate-500/15 text-slate-300',
};

const statIconStyles = {
  blue: 'bg-blue-500/15 text-blue-300',
  green: 'bg-emerald-500/15 text-emerald-300',
  purple: 'bg-purple-500/15 text-purple-300',
  orange: 'bg-amber-500/15 text-amber-300',
};

const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatWeekdayLabel = (date) => {
  const label = WEEKDAY_FORMATTER.format(date).replace('.', '');
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const formatMonthLabel = (date) => {
  const label = MONTH_FORMATTER.format(date).replace('.', '');
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const formatNumberValue = (value) => {
  if (value === null || value === undefined) {
    return '—';
  }
  const numeric = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (Number.isNaN(numeric)) {
    return '—';
  }
  return NUMBER_FORMATTER.format(numeric);
};

const formatPercentValue = (value) => {
  if (value === null || value === undefined) {
    return '—';
  }
  const numeric = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (Number.isNaN(numeric)) {
    return '—';
  }
  return `${numeric.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
};

const calcChange = (current, previous) => {
  if (current === null || current === undefined || Number.isNaN(current)) {
    return '—';
  }
  if (previous === null || previous === undefined || Number.isNaN(previous)) {
    return '—';
  }
  if (previous === 0) {
    if (current === 0) {
      return '0%';
    }
    return '+100%';
  }
  const diff = ((current - previous) / previous) * 100;
  const formatted = diff.toFixed(1).replace('.', ',');
  return `${diff >= 0 ? '+' : ''}${formatted}%`;
};

const deriveTrend = (change) => {
  if (!change || change === '—') return 'neutral';
  if (change.startsWith('-')) return 'down';
  if (change === '0%' || change === '+0%' || change === '0,0%' || change === '+0,0%') return 'neutral';
  return 'up';
};

const createDayBuckets = (days = 7) => {
  const buckets = [];
  const map = new Map();
  const today = new Date();

  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - index);
    const key = date.toISOString().slice(0, 10);
    const bucket = { date, abertos: 0, pendentes: 0, fechados: 0 };
    buckets.push(bucket);
    map.set(key, bucket);
  }

  return { list: buckets, map };
};

const normalizeTicketStatus = (status) => {
  const normalized = String(status ?? '').toUpperCase();
  if (normalized === 'OPEN' || normalized === 'ASSIGNED') return 'open';
  if (normalized === 'PENDING' || normalized === 'WAITING') return 'pending';
  if (normalized === 'RESOLVED' || normalized === 'CLOSED') return 'resolved';
  return 'pending';
};

const normalizeTicketPriority = (priority) => {
  const normalized = String(priority ?? '').toUpperCase();
  if (normalized === 'URGENT' || normalized === 'HIGH') return 'high';
  if (normalized === 'LOW') return 'low';
  return 'medium';
};

const normalizeChannel = (channel) => {
  const normalized = String(channel ?? '').toUpperCase();
  switch (normalized) {
    case 'WHATSAPP':
      return 'whatsapp';
    case 'EMAIL':
      return 'email';
    case 'PHONE':
      return 'phone';
    case 'VOICE':
    case 'URA':
      return 'voice';
    case 'CHAT':
    case 'WEBCHAT':
      return 'chat';
    case 'SMS':
    case 'TEXT':
      return 'sms';
    case 'SOCIAL':
    case 'INSTAGRAM':
    case 'FACEBOOK':
      return 'social';
    default:
      return 'other';
  }
};

const getTicketDisplayId = (ticket) => {
  if (!ticket) return '#—';
  if (ticket.displayId) return ticket.displayId;
  if (ticket.reference) return ticket.reference;
  if (ticket.externalId) return ticket.externalId;
  if (ticket.id) {
    const id = String(ticket.id);
    return `#${id.slice(0, 8).toUpperCase()}`;
  }
  return '#—';
};

const getTicketCustomerName = (ticket) => {
  if (!ticket) return 'Cliente sem nome';
  const metadata = typeof ticket.metadata === 'object' && ticket.metadata !== null ? ticket.metadata : {};
  return (
    ticket.customerName ||
    ticket.contactName ||
    ticket.contact?.name ||
    metadata.contactName ||
    metadata.customerName ||
    'Cliente sem nome'
  );
};

const buildChannelDistribution = (channelCounts) => {
  const entries = Array.from(channelCounts.entries());
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  if (!total) {
    return [];
  }

  return entries
    .sort((a, b) => b[1] - a[1])
    .map(([channel, count]) => ({
      name: channelLabels[channel] ?? channel.charAt(0).toUpperCase() + channel.slice(1),
      value: Number(((count / total) * 100).toFixed(1)),
      color: channelColors[channel] ?? channelColors.other,
    }));
};

const buildRecentTickets = (tickets) =>
  tickets
    .map((ticket) => {
      if (!ticket) return null;
      const channel = normalizeChannel(ticket.channel);
      const timestamp =
        parseDate(ticket.updatedAt) ??
        parseDate(ticket.lastMessageAt) ??
        parseDate(ticket.createdAt);

      return {
        id: getTicketDisplayId(ticket),
        customer: getTicketCustomerName(ticket),
        subject: ticket.subject ?? ticket.lastMessagePreview ?? '—',
        status: normalizeTicketStatus(ticket.status),
        priority: normalizeTicketPriority(ticket.priority),
        channel,
        time: timestamp
          ? formatDistanceToNowStrict(timestamp, { addSuffix: true, locale: ptBR })
          : '—',
        _timestamp: timestamp ? timestamp.getTime() : 0,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b._timestamp - a._timestamp)
    .slice(0, 4)
    .map(({ _timestamp, ...ticket }) => ticket);

const processTickets = (ticketsData) => {
  const items = Array.isArray(ticketsData?.items) ? ticketsData.items : [];
  const dayBuckets = createDayBuckets();
  const channelCounts = new Map();
  const now = Date.now();

  let activeTickets = 0;
  let messagesToday = 0;
  let messagesYesterday = 0;

  items.forEach((ticket) => {
    const status = normalizeTicketStatus(ticket?.status);
    if (status === 'open' || status === 'pending') {
      activeTickets += 1;
    }

    const createdAt = parseDate(ticket?.createdAt);
    if (createdAt) {
      const key = createdAt.toISOString().slice(0, 10);
      const bucket = dayBuckets.map.get(key);
      if (bucket) {
        if (status === 'open') {
          bucket.abertos += 1;
        } else if (status === 'pending') {
          bucket.pendentes += 1;
        } else {
          bucket.fechados += 1;
        }
      }
    }

    const channel = normalizeChannel(ticket?.channel);
    channelCounts.set(channel, (channelCounts.get(channel) ?? 0) + 1);

    const lastMessageAt = parseDate(ticket?.lastMessageAt ?? ticket?.updatedAt);
    if (lastMessageAt) {
      const diff = now - lastMessageAt.getTime();
      if (diff >= 0 && diff < MS_IN_DAY) {
        messagesToday += 1;
      } else if (diff >= MS_IN_DAY && diff < MS_IN_DAY * 2) {
        messagesYesterday += 1;
      }
    }
  });

  const dailySeries = dayBuckets.list.map(({ date, ...counts }) => ({
    name: formatWeekdayLabel(date),
    ...counts,
  }));

  const lastDay = dailySeries[dailySeries.length - 1];
  const previousDay = dailySeries[dailySeries.length - 2];

  return {
    activeTickets,
    messagesToday,
    messagesYesterday,
    dailySeries,
    channelDistribution: buildChannelDistribution(channelCounts),
    recentTickets: buildRecentTickets(items),
    activeChange: calcChange(lastDay?.abertos ?? null, previousDay?.abertos ?? null),
    messageChange: calcChange(messagesToday, messagesYesterday),
  };
};

const buildMonthlySeries = (leads) => {
  const months = [];
  const monthMap = new Map();
  const current = new Date();

  for (let index = 5; index >= 0; index -= 1) {
    const date = new Date(current.getFullYear(), current.getMonth() - index, 1);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const entry = { key, date, name: formatMonthLabel(date), leads: 0, conversoes: 0 };
    months.push(entry);
    monthMap.set(key, entry);
  }

  leads.forEach((lead) => {
    const createdAt = parseDate(lead?.createdAt);
    if (!createdAt) return;

    const key = `${createdAt.getFullYear()}-${createdAt.getMonth()}`;
    const entry = monthMap.get(key);
    if (!entry) return;

    entry.leads += 1;
    const status = String(lead?.status ?? '').toUpperCase();
    if (status === 'CONVERTED') {
      entry.conversoes += 1;
    }
  });

  return months.map((entry) => ({
    name: entry.name,
    leads: entry.leads,
    conversoes: entry.conversoes,
    conversionRate: entry.leads > 0 ? (entry.conversoes / entry.leads) * 100 : 0,
  }));
};

const processLeads = (leadsData, dashboardMetrics) => {
  const items = Array.isArray(leadsData?.items) ? leadsData.items : [];
  const monthlySeries = buildMonthlySeries(items);

  const totalFromList = typeof leadsData?.total === 'number' ? leadsData.total : items.length;
  const totalLeads =
    typeof dashboardMetrics?.totalLeads === 'number' ? dashboardMetrics.totalLeads : totalFromList;

  const convertedFromList = items.filter(
    (lead) => String(lead?.status ?? '').toUpperCase() === 'CONVERTED'
  ).length;

  const totalHotLeads =
    typeof dashboardMetrics?.totalHotLeads === 'number'
      ? dashboardMetrics.totalHotLeads
      : convertedFromList;

  let conversionRate = 0;
  if (typeof dashboardMetrics?.conversionRate === 'number') {
    conversionRate = dashboardMetrics.conversionRate;
  } else if (typeof dashboardMetrics?.conversionRate === 'string') {
    const parsed = Number.parseFloat(dashboardMetrics.conversionRate);
    conversionRate = Number.isNaN(parsed) ? 0 : parsed;
  } else if (totalLeads > 0) {
    conversionRate = (totalHotLeads / totalLeads) * 100;
  }

  const latestMonth = monthlySeries[monthlySeries.length - 1];
  const previousMonth = monthlySeries[monthlySeries.length - 2];

  return {
    monthlySeries,
    totalLeads,
    conversionRate,
    leadsChange: calcChange(latestMonth?.leads ?? null, previousMonth?.leads ?? null),
    conversionChange: calcChange(
      latestMonth?.conversionRate ?? null,
      previousMonth?.conversionRate ?? null
    ),
  };
};

const buildDashboardModel = (ticketsData, leadsData, dashboardMetrics) => {
  const ticketInsights = processTickets(ticketsData);
  const leadInsights = processLeads(leadsData, dashboardMetrics);

  const stats = [
    {
      title: 'Tickets Ativos',
      value: formatNumberValue(ticketInsights.activeTickets),
      change: ticketInsights.activeChange,
      trend: deriveTrend(ticketInsights.activeChange),
      icon: Ticket,
      color: 'blue',
    },
    {
      title: 'Leads Novos',
      value: formatNumberValue(leadInsights.totalLeads),
      change: leadInsights.leadsChange,
      trend: deriveTrend(leadInsights.leadsChange),
      icon: Users,
      color: 'green',
    },
    {
      title: 'Mensagens Hoje',
      value: formatNumberValue(ticketInsights.messagesToday),
      change: ticketInsights.messageChange,
      trend: deriveTrend(ticketInsights.messageChange),
      icon: MessageSquare,
      color: 'purple',
    },
    {
      title: 'Taxa de Conversão',
      value: formatPercentValue(leadInsights.conversionRate),
      change: leadInsights.conversionChange,
      trend: deriveTrend(leadInsights.conversionChange),
      icon: TrendingUp,
      color: 'orange',
    },
  ];

  return {
    stats,
    ticketsSeries: ticketInsights.dailySeries,
    leadsSeries: leadInsights.monthlySeries,
    channelDistribution: ticketInsights.channelDistribution,
    recentTickets: ticketInsights.recentTickets,
  };
};

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
    high: 'text-red-500',
    medium: 'text-yellow-500',
    low: 'text-green-500',
  };
  return colors[priority] || 'text-gray-500';
};

const getChannelIcon = (channel) => {
  const icons = {
    whatsapp: MessageSquare,
    email: Mail,
    phone: Phone,
    voice: Phone,
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
    'radial-gradient(circle at top left, rgba(99,102,241,0.2), transparent 55%), radial-gradient(circle at bottom right, rgba(34,197,94,0.15), transparent 60%), rgba(15,23,42,0.65)',
  boxShadow: '0 24px 60px rgba(15, 23, 42, 0.45)',
};

const Dashboard = ({ onboarding, onStart }) => {
  const ticketsQuery = useQuery({
    queryKey: ['tickets', 'dashboard'],
    queryFn: async () => {
      const payload = await apiGet('/api/tickets?limit=100');
      return payload?.data ?? null;
    },
  });

  const leadsQuery = useQuery({
    queryKey: ['leads', 'dashboard'],
    queryFn: async () => {
      const payload = await apiGet('/api/leads?limit=200');
      return payload?.data ?? null;
    },
  });

  const leadMetricsQuery = useQuery({
    queryKey: ['lead-engine', 'dashboard'],
    queryFn: async () => {
      const payload = await apiGet('/api/lead-engine/dashboard');
      return payload?.data ?? null;
    },
  });

  const { stats, ticketsSeries, leadsSeries, channelDistribution, recentTickets } = useMemo(
    () => buildDashboardModel(ticketsQuery.data, leadsQuery.data, leadMetricsQuery.data),
    [ticketsQuery.data, leadsQuery.data, leadMetricsQuery.data]
  );

  const errorMessages = [
    ticketsQuery.error instanceof Error ? `Tickets: ${ticketsQuery.error.message}` : null,
    leadsQuery.error instanceof Error ? `Leads: ${leadsQuery.error.message}` : null,
    leadMetricsQuery.error instanceof Error
      ? `Métricas do Lead Engine: ${leadMetricsQuery.error.message}`
      : null,
  ].filter(Boolean);

  const statsLoading = ticketsQuery.isLoading || leadsQuery.isLoading || leadMetricsQuery.isLoading;
  const ticketsChartLoading = ticketsQuery.isLoading;
  const leadsChartLoading = leadsQuery.isLoading || leadMetricsQuery.isLoading;
  const channelLoading = ticketsQuery.isLoading;
  const recentTicketsLoading = ticketsQuery.isLoading;

  const handleRetry = () => {
    void ticketsQuery.refetch();
    void leadsQuery.refetch();
    void leadMetricsQuery.refetch();
  };

  const { total, progressValue, displayIndex, nextStage, isComplete } = getOnboardingProgress(onboarding);
  const stageLabel = nextStage || 'Conclua as etapas';
  const hasStarted = Boolean(onboarding?.selectedAgreement || onboarding?.whatsappStatus !== 'disconnected');
  const primaryCtaLabel = hasStarted ? 'Continuar configuração' : 'Ativar meu primeiro convênio';

  return (
    <div className="space-y-6">
      <div
        className="grid gap-6 rounded-[24px] border border-[rgba(99,102,241,0.2)] p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
        style={heroStyle}
      >
        <div className="grid max-w-xl gap-4">
          <h1 className="text-3xl font-semibold text-foreground">Mudamos a forma de gerar demanda</h1>
          <p className="text-base leading-relaxed text-muted-foreground">
            Conecte um convênio, sincronize seu WhatsApp e receba apenas leads que já levantaram a mão. Acompanhe tudo em
            tempo real neste painel.
          </p>
          {total ? (
            <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between text-xs uppercase tracking-wide text-[rgba(226,232,240,0.72)]">
                <span>Primeira configuração</span>
                <span>
                  {displayIndex} de {total}
                </span>
              </div>
              <Progress value={progressValue} className="h-2" />
              <p className="text-xs text-slate-300">
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
          <div className="grid min-w-[220px] gap-3 rounded-2xl border border-white/10 bg-[rgba(15,23,42,0.5)] p-4">
            {onboarding.stages.map((stage, index) => {
              const status =
                index < onboarding.activeStep
                  ? 'done'
                  : index === onboarding.activeStep
                  ? 'current'
                  : 'todo';
              const statusClasses = {
                done: 'border-emerald-500/40 bg-emerald-500/20',
                current: 'border-[rgba(99,102,241,0.4)] bg-[rgba(99,102,241,0.16)]',
                todo: 'border-white/5 bg-white/5',
              };
              const indexClasses = {
                done: 'bg-emerald-500 text-[#022c17] border-transparent',
                current: 'bg-[var(--primary)] text-[var(--primary-foreground)] border-transparent',
                todo: 'bg-white/10 text-[var(--text-muted)] border-white/20',
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

      {errorMessages.length > 0 ? (
        <Alert variant="destructive" className="border-destructive/40 bg-destructive/10">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Não foi possível carregar todos os dados do painel.</AlertTitle>
          <AlertDescription>
            {errorMessages.map((message, index) => (
              <p key={index}>{message}</p>
            ))}
            <Button size="sm" variant="outline" className="mt-2" onClick={handleRetry}>
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statsLoading
          ? Array.from({ length: 4 }).map((_, index) => (
              <Card key={`stat-skeleton-${index}`} className="transition-shadow duration-200 hover:shadow-lg">
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
          : stats.map((stat, index) => (
              <Card key={`${stat.title}-${index}`} className="transition-shadow duration-200 hover:shadow-lg">
                <CardContent className="space-y-4 p-6">
                  <div className="flex items-center justify-between">
                    <div className={cn('flex items-center justify-center rounded-lg p-2', statIconStyles[stat.color])}>
                      <stat.icon className="h-5 w-5" />
                    </div>
                    <Badge className={changeBadgeVariants[stat.trend] ?? changeBadgeVariants.neutral}>
                      {stat.change}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-2xl font-semibold text-foreground">{stat.value}</h3>
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="transition-shadow duration-200 hover:shadow-lg">
          <CardHeader>
            <CardTitle>Tickets por Dia</CardTitle>
            <CardDescription>Acompanhe o volume de tickets abertos, fechados e pendentes</CardDescription>
          </CardHeader>
          <CardContent>
            {ticketsChartLoading ? (
              <Skeleton className="h-[300px] w-full rounded-lg" />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={ticketsSeries}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="abertos" fill="#ef4444" name="Abertos" />
                    <Bar dataKey="fechados" fill="#22c55e" name="Fechados" />
                    <Bar dataKey="pendentes" fill="#f59e0b" name="Pendentes" />
                  </BarChart>
                </ResponsiveContainer>
                {ticketsSeries.length === 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Nenhum ticket registrado nos últimos dias.
                  </p>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

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
                    <Line type="monotone" dataKey="leads" stroke="#3b82f6" strokeWidth={2} name="Leads" />
                    <Line
                      type="monotone"
                      dataKey="conversoes"
                      stroke="#10b981"
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
        <Card className="transition-shadow duration-200 hover:shadow-lg lg:col-span-1">
          <CardHeader>
            <CardTitle>Canais de Atendimento</CardTitle>
            <CardDescription>Distribuição de tickets por canal</CardDescription>
          </CardHeader>
          <CardContent>
            {channelLoading ? (
              <Skeleton className="h-[240px] w-full rounded-lg" />
            ) : channelDistribution.length > 0 ? (
              <>
                <div className="mb-4">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={channelDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {channelDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `${value}%`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                  {channelDistribution.map((channel, index) => (
                    <div key={`${channel.name}-${index}`} className="flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: channel.color }}
                        />
                        <span className="text-foreground">{channel.name}</span>
                      </div>
                      <span className="font-medium">{channel.value}%</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Não há dados suficientes para calcular a distribuição por canal.
              </p>
            )}
          </CardContent>
        </Card>

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
                    className="flex animate-pulse items-start justify-between gap-4 rounded-lg border border-[var(--border)] bg-[rgba(15,23,42,0.35)] p-4"
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
                    className="flex transform items-start justify-between gap-4 rounded-lg border border-[var(--border)] bg-[rgba(15,23,42,0.35)] p-4 transition-all duration-200 ease-in-out hover:scale-[1.02] hover:bg-[rgba(99,102,241,0.08)]"
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
              <div className="rounded-[var(--radius)] border border-dashed border-[var(--border)]/70 p-6 text-center text-sm text-muted-foreground">
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
