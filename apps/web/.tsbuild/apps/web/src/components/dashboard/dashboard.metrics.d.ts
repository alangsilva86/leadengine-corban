export type ChannelKey = 'whatsapp' | 'email' | 'phone' | 'chat' | 'sms' | 'social' | 'other';
export type TicketStatus = 'open' | 'pending' | 'resolved';
export type TicketPriority = 'high' | 'medium' | 'low';
export type TrendDirection = 'up' | 'down' | 'neutral';
export interface DashboardTicket {
    id?: string | number | null;
    displayId?: string | null;
    reference?: string | null;
    externalId?: string | null;
    customerName?: string | null;
    contactName?: string | null;
    contact?: {
        name?: string | null;
    } | null;
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
export declare const formatNumberValue: (value: number | string | null | undefined) => string;
export declare const formatPercentValue: (value: number | string | null | undefined) => string;
export declare const deriveTrend: (change: string | null | undefined) => TrendDirection;
export declare const buildChannelDistribution: (channelCounts: Map<ChannelKey, number>) => ChannelDistributionEntry[];
export declare const processTickets: (ticketsData: DashboardTicketsResponse | null | undefined) => TicketInsights;
export declare const processLeads: (leadsData: DashboardLeadsResponse | null | undefined, dashboardMetrics: DashboardOverviewMetrics | null | undefined) => LeadInsights;
export declare const buildDashboardMetrics: (ticketsData: DashboardTicketsResponse | null | undefined, leadsData: DashboardLeadsResponse | null | undefined, dashboardMetrics: DashboardOverviewMetrics | null | undefined) => DashboardMetricsResult;
