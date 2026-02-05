import type { TicketSeriesEntry } from '../useDashboardData';
export interface TicketsDailyWidgetProps {
    data: TicketSeriesEntry[];
    loading?: boolean;
    className?: string;
}
export declare const TicketsDailyWidget: import("react").MemoExoticComponent<({ data, loading, className }: TicketsDailyWidgetProps) => import("react/jsx-runtime").JSX.Element>;
