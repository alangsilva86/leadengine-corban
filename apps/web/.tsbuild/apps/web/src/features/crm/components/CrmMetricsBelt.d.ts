import type { CrmMetricPrimitive } from '../state/metrics';
type CrmMetricsBeltProps = {
    metrics: CrmMetricPrimitive[];
    loading?: boolean;
    source?: 'api' | 'fallback';
    onRefresh?: () => void;
};
declare const CrmMetricsBelt: ({ metrics, loading, source, onRefresh }: CrmMetricsBeltProps) => import("react/jsx-runtime").JSX.Element;
export default CrmMetricsBelt;
