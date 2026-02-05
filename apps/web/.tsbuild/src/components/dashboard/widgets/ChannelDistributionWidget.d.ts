import type { ChannelDistributionEntry } from '../useDashboardData';
export interface ChannelDistributionWidgetProps {
    data: ChannelDistributionEntry[];
    loading?: boolean;
    className?: string;
}
export declare const ChannelDistributionWidget: import("react").MemoExoticComponent<({ data, loading, className }: ChannelDistributionWidgetProps) => import("react/jsx-runtime").JSX.Element>;
