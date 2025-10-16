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
  type DashboardLeadsResponse,
  type DashboardMetricsResult,
  type DashboardOverviewMetrics,
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

export interface DashboardDataHookResult {
  stats: DashboardStat[];
  ticketsSeries: TicketSeriesEntry[];
  leadsSeries: LeadSeriesEntry[];
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

  const leadsQuery = useQuery<DashboardLeadsResponse | null>({
    queryKey: ['leads', 'dashboard'],
    queryFn: async () => {
      const payload = await apiGet('/api/leads?size=200');
      return (payload?.data ?? null) as DashboardLeadsResponse | null;
    },
  });

  const leadMetricsQuery = useQuery<DashboardOverviewMetrics | null>({
    queryKey: ['lead-engine', 'dashboard'],
    queryFn: async () => {
      const payload = await apiGet('/api/lead-engine/dashboard');
      return (payload?.data ?? null) as DashboardOverviewMetrics | null;
    },
  });

  const { refetch: refetchTickets } = ticketsQuery;
  const { refetch: refetchLeads } = leadsQuery;
  const { refetch: refetchLeadMetrics } = leadMetricsQuery;

  const metrics = useMemo(
    () => buildDashboardMetrics(ticketsQuery.data, leadsQuery.data, leadMetricsQuery.data),
    [ticketsQuery.data, leadsQuery.data, leadMetricsQuery.data]
  );

  const stats = useMemo<DashboardStat[]>(() => {
    const { ticketInsights, leadInsights } = metrics;

    return [
      {
        id: 'activeTickets',
        title: 'Tickets Ativos',
        value: formatNumberValue(ticketInsights.activeTickets),
        change: ticketInsights.activeChange,
        trend: deriveTrend(ticketInsights.activeChange),
        icon: Ticket,
        color: 'blue',
      },
      {
        id: 'newLeads',
        title: 'Leads Novos',
        value: formatNumberValue(leadInsights.totalLeads),
        change: leadInsights.leadsChange,
        trend: deriveTrend(leadInsights.leadsChange),
        icon: Users,
        color: 'green',
      },
      {
        id: 'messagesToday',
        title: 'Mensagens Hoje',
        value: formatNumberValue(ticketInsights.messagesToday),
        change: ticketInsights.messageChange,
        trend: deriveTrend(ticketInsights.messageChange),
        icon: MessageSquare,
        color: 'purple',
      },
      {
        id: 'conversionRate',
        title: 'Taxa de Conversão',
        value: formatPercentValue(leadInsights.conversionRate),
        change: leadInsights.conversionChange,
        trend: deriveTrend(leadInsights.conversionChange),
        icon: TrendingUp,
        color: 'orange',
      },
    ];
  }, [metrics]);

  const errorMessages = useMemo(
    () =>
      [
        ticketsQuery.error instanceof Error ? `Tickets: ${ticketsQuery.error.message}` : null,
        leadsQuery.error instanceof Error ? `Leads: ${leadsQuery.error.message}` : null,
        leadMetricsQuery.error instanceof Error
          ? `Métricas do Lead Engine: ${leadMetricsQuery.error.message}`
          : null,
      ].filter((message): message is string => Boolean(message)),
    [ticketsQuery.error, leadsQuery.error, leadMetricsQuery.error]
  );

  const loading: DashboardLoadingState = {
    stats: ticketsQuery.isLoading || leadsQuery.isLoading || leadMetricsQuery.isLoading,
    ticketsChart: ticketsQuery.isLoading,
    leadsChart: leadsQuery.isLoading || leadMetricsQuery.isLoading,
    channelDistribution: ticketsQuery.isLoading,
    recentTickets: ticketsQuery.isLoading,
  };

  const refetchAll = useCallback(() => {
    void refetchTickets();
    void refetchLeads();
    void refetchLeadMetrics();
  }, [refetchTickets, refetchLeads, refetchLeadMetrics]);

  return {
    stats,
    ticketsSeries: metrics.ticketsSeries,
    leadsSeries: metrics.leadsSeries,
    channelDistribution: metrics.channelDistribution,
    recentTickets: metrics.recentTickets,
    loading,
    errors: errorMessages,
    refetchAll,
    rawMetrics: metrics,
  };
};

export type { ChannelDistributionEntry, TicketSeriesEntry, LeadSeriesEntry, RecentTicketEntry };
