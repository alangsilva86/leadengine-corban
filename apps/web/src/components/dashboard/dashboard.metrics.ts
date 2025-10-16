import { formatDistanceToNowStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' });
const MONTH_FORMATTER = new Intl.DateTimeFormat('pt-BR', { month: 'short' });
const NUMBER_FORMATTER = new Intl.NumberFormat('pt-BR');
const MS_IN_DAY = 24 * 60 * 60 * 1000;

export type ChannelKey = 'whatsapp' | 'email' | 'phone' | 'chat' | 'sms' | 'social' | 'other';
export type TicketStatus = 'open' | 'pending' | 'resolved';
export type TicketPriority = 'high' | 'medium' | 'low';
export type TrendDirection = 'up' | 'down' | 'neutral';

const channelLabels: Record<ChannelKey, string> = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  phone: 'Telefone',
  chat: 'Chat',
  sms: 'SMS',
  social: 'Redes sociais',
  other: 'Outros',
};

const channelColors: Record<ChannelKey, string> = {
  whatsapp: 'var(--status-whatsapp)',
  email: 'var(--color-chart-1)',
  phone: 'var(--color-chart-2)',
  chat: 'var(--color-chart-4)',
  sms: 'var(--color-chart-3)',
  social: 'var(--color-chart-5)',
  other: 'var(--muted)',
};

export interface DashboardTicket {
  id?: string | number | null;
  displayId?: string | null;
  reference?: string | null;
  externalId?: string | null;
  customerName?: string | null;
  contactName?: string | null;
  contact?: { name?: string | null } | null;
  metadata?: Record<string, unknown> | null;
  subject?: string | null;
  lastMessagePreview?: string | null;
  status?: string | null;
  priority?: string | null;
  channel?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  lastMessageAt?: string | null;
}

export interface DashboardTicketsResponse {
  items?: DashboardTicket[] | null;
}

export interface DashboardLead {
  id?: string | number | null;
  status?: string | null;
  createdAt?: string | null;
}

export interface DashboardLeadsResponse {
  items?: DashboardLead[] | null;
  total?: number | null;
}

export interface DashboardOverviewMetrics {
  totalLeads?: number | null;
  totalHotLeads?: number | null;
  conversionRate?: number | string | null;
}

export interface ChannelDistributionEntry {
  name: string;
  value: number;
  color: string;
}

export interface TicketSeriesEntry {
  name: string;
  abertos: number;
  pendentes: number;
  fechados: number;
}

export interface LeadSeriesEntry {
  name: string;
  leads: number;
  conversoes: number;
  conversionRate: number;
}

export interface RecentTicketEntry {
  id: string;
  customer: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  channel: ChannelKey;
  time: string;
}

export interface TicketInsights {
  activeTickets: number;
  messagesToday: number;
  messagesYesterday: number;
  dailySeries: TicketSeriesEntry[];
  channelDistribution: ChannelDistributionEntry[];
  recentTickets: RecentTicketEntry[];
  activeChange: string;
  messageChange: string;
}

export interface LeadInsights {
  monthlySeries: LeadSeriesEntry[];
  totalLeads: number;
  conversionRate: number;
  leadsChange: string;
  conversionChange: string;
}

export interface DashboardMetricsResult {
  ticketInsights: TicketInsights;
  leadInsights: LeadInsights;
  ticketsSeries: TicketSeriesEntry[];
  leadsSeries: LeadSeriesEntry[];
  channelDistribution: ChannelDistributionEntry[];
  recentTickets: RecentTicketEntry[];
}

const parseDate = (value: unknown): Date | null => {
  if (value === null || value === undefined) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatWeekdayLabel = (date: Date): string => {
  const label = WEEKDAY_FORMATTER.format(date).replace('.', '');
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const formatMonthLabel = (date: Date): string => {
  const label = MONTH_FORMATTER.format(date).replace('.', '');
  return label.charAt(0).toUpperCase() + label.slice(1);
};

export const formatNumberValue = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined) {
    return '—';
  }
  const numeric = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (Number.isNaN(numeric)) {
    return '—';
  }
  return NUMBER_FORMATTER.format(numeric);
};

export const formatPercentValue = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined) {
    return '—';
  }
  const numeric = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (Number.isNaN(numeric)) {
    return '—';
  }
  return `${numeric.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
};

const calcChange = (current: number | null, previous: number | null): string => {
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

export const deriveTrend = (change: string | null | undefined): TrendDirection => {
  if (!change || change === '—') return 'neutral';
  if (change.startsWith('-')) return 'down';
  if (change === '0%' || change === '+0%' || change === '0,0%' || change === '+0,0%') return 'neutral';
  return 'up';
};

const createDayBuckets = (days = 7): {
  list: Array<{ date: Date; abertos: number; pendentes: number; fechados: number }>;
  map: Map<string, { date: Date; abertos: number; pendentes: number; fechados: number }>;
} => {
  const buckets: Array<{ date: Date; abertos: number; pendentes: number; fechados: number }> = [];
  const map = new Map<string, { date: Date; abertos: number; pendentes: number; fechados: number }>();
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

const normalizeTicketStatus = (status: unknown): TicketStatus => {
  const normalized = String(status ?? '').toUpperCase();
  if (normalized === 'OPEN' || normalized === 'ASSIGNED') return 'open';
  if (normalized === 'PENDING' || normalized === 'WAITING') return 'pending';
  if (normalized === 'RESOLVED' || normalized === 'CLOSED') return 'resolved';
  return 'pending';
};

const normalizeTicketPriority = (priority: unknown): TicketPriority => {
  const normalized = String(priority ?? '').toUpperCase();
  if (normalized === 'URGENT' || normalized === 'HIGH') return 'high';
  if (normalized === 'LOW') return 'low';
  return 'medium';
};

const normalizeChannel = (channel: unknown): ChannelKey => {
  const normalized = String(channel ?? '').toUpperCase();
  switch (normalized) {
    case 'WHATSAPP':
      return 'whatsapp';
    case 'EMAIL':
      return 'email';
    case 'PHONE':
      return 'phone';
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

const getTicketDisplayId = (ticket: DashboardTicket | null | undefined): string => {
  if (!ticket) return '#—';
  if (ticket.displayId) return ticket.displayId;
  if (ticket.reference) return ticket.reference;
  if (ticket.externalId) return ticket.externalId;
  if (ticket.id !== null && ticket.id !== undefined) {
    const id = String(ticket.id);
    return `#${id.slice(0, 8).toUpperCase()}`;
  }
  return '#—';
};

const getTicketCustomerName = (ticket: DashboardTicket | null | undefined): string => {
  if (!ticket) return 'Cliente sem nome';
  const metadata = typeof ticket.metadata === 'object' && ticket.metadata !== null ? ticket.metadata : {};
  const metadataContactName = typeof metadata.contactName === 'string' ? metadata.contactName : undefined;
  const metadataCustomerName = typeof metadata.customerName === 'string' ? metadata.customerName : undefined;

  return (
    ticket.customerName ||
    ticket.contactName ||
    (ticket.contact && typeof ticket.contact.name === 'string' ? ticket.contact.name : undefined) ||
    metadataContactName ||
    metadataCustomerName ||
    'Cliente sem nome'
  );
};

export const buildChannelDistribution = (channelCounts: Map<ChannelKey, number>): ChannelDistributionEntry[] => {
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

const buildRecentTickets = (tickets: DashboardTicket[]): RecentTicketEntry[] =>
  tickets
    .map((ticket) => {
      if (!ticket) return null;
      const channel = normalizeChannel(ticket.channel);
      const timestamp =
        parseDate(ticket.updatedAt) ?? parseDate(ticket.lastMessageAt) ?? parseDate(ticket.createdAt);

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
    .filter((item): item is RecentTicketEntry & { _timestamp: number } => Boolean(item))
    .sort((a, b) => b._timestamp - a._timestamp)
    .slice(0, 4)
    .map((ticketWithSortKey) => {
      const { _timestamp: _unusedTimestamp, ...ticket } = ticketWithSortKey;
      return ticket;
    });

export const processTickets = (ticketsData: DashboardTicketsResponse | null | undefined): TicketInsights => {
  const items = Array.isArray(ticketsData?.items) ? ticketsData.items : [];
  const dayBuckets = createDayBuckets();
  const channelCounts = new Map<ChannelKey, number>();
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

const buildMonthlySeries = (leads: DashboardLead[]): LeadSeriesEntry[] => {
  const months: Array<{ key: string; date: Date; name: string; leads: number; conversoes: number }> = [];
  const monthMap = new Map<string, { key: string; date: Date; name: string; leads: number; conversoes: number }>();
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

export const processLeads = (
  leadsData: DashboardLeadsResponse | null | undefined,
  dashboardMetrics: DashboardOverviewMetrics | null | undefined
): LeadInsights => {
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
    conversionChange: calcChange(latestMonth?.conversionRate ?? null, previousMonth?.conversionRate ?? null),
  };
};

export const buildDashboardMetrics = (
  ticketsData: DashboardTicketsResponse | null | undefined,
  leadsData: DashboardLeadsResponse | null | undefined,
  dashboardMetrics: DashboardOverviewMetrics | null | undefined
): DashboardMetricsResult => {
  const ticketInsights = processTickets(ticketsData);
  const leadInsights = processLeads(leadsData, dashboardMetrics);

  return {
    ticketInsights,
    leadInsights,
    ticketsSeries: ticketInsights.dailySeries,
    leadsSeries: leadInsights.monthlySeries,
    channelDistribution: ticketInsights.channelDistribution,
    recentTickets: ticketInsights.recentTickets,
  };
};
