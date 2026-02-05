import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { formatNumber } from '../utils/campaign-helpers.js';
const CampaignMetricsGrid = ({ metrics = [], loading = false, fallback = null }) => {
    const items = Array.isArray(metrics) ? metrics : [];
    const hasItems = items.length > 0;
    if (loading) {
        const skeletonCount = hasItems ? items.length : 4;
        return (_jsx("div", { className: "grid gap-3 sm:grid-cols-2 lg:grid-cols-4", children: Array.from({ length: skeletonCount }).map((_, index) => (_jsx(Skeleton, { className: "h-20 rounded-lg" }, index))) }));
    }
    if (!hasItems) {
        if (!fallback) {
            return null;
        }
        return (_jsx("div", { className: "grid gap-3 sm:grid-cols-2 lg:grid-cols-4", children: _jsx("div", { className: "sm:col-span-2 lg:col-span-4 rounded-lg border border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] p-4 text-sm text-muted-foreground", children: fallback }) }));
    }
    return (_jsx("div", { className: "grid gap-3 sm:grid-cols-2 lg:grid-cols-4", children: items.map((item) => (_jsxs("div", { className: "rounded-lg border border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] p-3 text-center", children: [_jsx("p", { className: "text-[0.65rem] uppercase tracking-wide text-muted-foreground", children: item.label }), _jsx("p", { className: "mt-1 text-lg font-semibold text-foreground", children: formatNumber(item.value) })] }, item.label))) }));
};
export default CampaignMetricsGrid;
