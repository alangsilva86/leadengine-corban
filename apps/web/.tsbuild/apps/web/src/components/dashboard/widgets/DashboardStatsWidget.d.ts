import type { DashboardStat } from '../useDashboardData';
export interface DashboardStatsWidgetProps {
    stats: DashboardStat[];
    loading?: boolean;
    className?: string;
}
export declare const DashboardStatsWidget: import("react").MemoExoticComponent<({ stats, loading, className }: DashboardStatsWidgetProps) => import("react/jsx-runtime").JSX.Element>;
