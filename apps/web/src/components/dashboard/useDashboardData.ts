import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react';
import { Ticket, Users, MessageSquare, TrendingUp } from 'lucide-react';
import { apiGet } from '@/lib/api.js';
import {
  buildDashboardMetrics,
  deriveTrend,
  formatNumberValue,
  formatPercentValue,
  type ChannelDistributionEntry,
  type DashboardMetricsResult,
  channelPresentation,
  type DashboardTicketsResponse,
  type LeadSeriesEntry,
  type RecentTicketEntry,
  type TicketSeriesEntry,
  type TrendDirection,
} from './dashboard.metrics';

export interface DashboardStat {
  id: string;
  title: string;
  value: string;
  change: string;
  trend: TrendDirection;
  icon: LucideIcon;
  color: 'blue' | 'green' | 'purple' | 'orange';
}

export interface DashboardLoadingState {
  stats: boolean;
  ticketsChart: boolean;
  leadsChart: boolean;
  channelDistribution: boolean;
  recentTickets: boolean;
}

type DashboardOverview = {
  activeTickets: number;
  totalLeads: number;
  messagesToday: number;
  messagesYesterday: number;
  conversionRate: number | null;
  ticketsSeries: TicketSeriesEntry[];
  leadsSeries: Pick<LeadSeriesEntry, 'name' | 'leads'>[];
  channels: { channel: string; total: number }[];
};

export interface DashboardDataHookResult {
  stats: DashboardStat[];
  ticketsSeries: TicketSeriesEntry[];
  leadsSeries: DashboardOverview['leadsSeries'];
  channelDistribution: ChannelDistributionEntry[];
  recentTickets: RecentTicketEntry[];
  loading: DashboardLoadingState;
  errors: string[];
  refetchAll: () => void;
  rawMetrics: DashboardMetricsResult;
}

export const useDashboardData = (): DashboardDataHookResult => {
  const ticketsQuery = useQuery<DashboardTicketsResponse | null>({
    queryKey: ['tickets', 'dashboard'],
    queryFn: async () => {
      const payload = await apiGet('/api/tickets?limit=100');
      return (payload?.data ?? null) as DashboardTicketsResponse | null;
    },
  });

  const overviewQuery = useQuery<DashboardOverview>({
    queryKey: ['crm', 'dashboard'],
    queryFn: async () => (await apiGet('/api/crm/dashboard')).data,
  });
  const overview = overviewQuery.data;
  const metrics = useMemo(() => buildDashboardMetrics(ticketsQuery.data, null, null), [ticketsQuery.data]);
  const channels = overview?.channels.map(({ channel, total }) => ({ ...channelPresentation(channel), value: total })) ?? [];

  const stats = useMemo<DashboardStat[]>(() => {
    const messageChange = overview && overview.messagesYesterday > 0
      ? (() => {
          const pct = Math.round(((overview.messagesToday - overview.messagesYesterday) / overview.messagesYesterday) * 100);
          return `${pct > 0 ? '+' : ''}${pct}% vs. ontem`;
        })()
      : '—';

    return [
      {
        id: 'activeTickets',
        title: 'Conversas abertas',
        value: formatNumberValue(overview?.activeTickets),
        change: '—',
        trend: 'neutral',
        icon: Ticket,
        color: 'blue',
      },
      {
        id: 'newLeads',
        title: 'Leads cadastrados',
        value: formatNumberValue(overview?.totalLeads),
        change: '—',
        trend: 'neutral',
        icon: Users,
        color: 'green',
      },
      {
        id: 'messagesToday',
        title: 'Mensagens hoje',
        value: formatNumberValue(overview?.messagesToday),
        change: messageChange,
        trend: deriveTrend(messageChange),
        icon: MessageSquare,
        color: 'purple',
      },
      {
        id: 'conversionRate',
        title: 'Taxa de conversão',
        value: formatPercentValue(overview?.conversionRate),
        change: '—',
        trend: 'neutral',
        icon: TrendingUp,
        color: 'orange',
      },
    ];
  }, [overview]);

  const errorMessages = [ticketsQuery.error, overviewQuery.error]
    .flatMap(error => error instanceof Error ? [error.message] : []);
  const loading: DashboardLoadingState = {
    stats: overviewQuery.isLoading, ticketsChart: overviewQuery.isLoading,
    leadsChart: overviewQuery.isLoading, channelDistribution: overviewQuery.isLoading,
    recentTickets: ticketsQuery.isLoading,
  };
  const { refetch: refetchTickets } = ticketsQuery;
  const { refetch: refetchOverview } = overviewQuery;
  const refetchAll = useCallback(() => {
    void refetchTickets();
    void refetchOverview();
  }, [refetchTickets, refetchOverview]);

  return {
    stats,
    ticketsSeries: overview?.ticketsSeries ?? [],
    leadsSeries: overview?.leadsSeries ?? [],
    channelDistribution: channels,
    recentTickets: metrics.recentTickets,
    loading,
    errors: errorMessages,
    refetchAll,
    rawMetrics: metrics,
  };
};

export type { ChannelDistributionEntry, TicketSeriesEntry, LeadSeriesEntry, RecentTicketEntry };
