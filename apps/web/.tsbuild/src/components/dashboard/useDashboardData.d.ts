import type { LucideIcon } from 'lucide-react';
import { type ChannelDistributionEntry, type DashboardMetricsResult, type LeadSeriesEntry, type RecentTicketEntry, type TicketSeriesEntry, type TrendDirection } from './dashboard.metrics';
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
export declare const useDashboardData: () => DashboardDataHookResult;
export type { ChannelDistributionEntry, TicketSeriesEntry, LeadSeriesEntry, RecentTicketEntry };
