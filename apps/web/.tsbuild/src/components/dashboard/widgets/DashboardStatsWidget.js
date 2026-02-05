import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { memo } from 'react';
import { Card, CardContent } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { cn } from '@/lib/utils.js';
const changeBadgeVariants = {
    up: 'bg-success/15 text-success-strong-foreground',
    down: 'bg-error/15 text-error-soft-foreground',
    neutral: 'bg-muted text-muted-foreground',
};
const statIconStyles = {
    blue: 'bg-primary/15 text-primary',
    green: 'bg-success/15 text-success',
    purple: 'bg-accent text-accent-foreground',
    orange: 'bg-warning/15 text-warning',
};
const DashboardStatsWidgetComponent = ({ stats, loading = false, className }) => (_jsx("div", { className: cn('grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4', className), children: loading
        ? Array.from({ length: 4 }).map((_, index) => (_jsx(Card, { className: "transition-shadow duration-200 hover:shadow-lg", "data-testid": "dashboard-stat-skeleton", children: _jsxs(CardContent, { className: "space-y-4 p-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx(Skeleton, { className: "h-10 w-10 rounded-lg" }), _jsx(Skeleton, { className: "h-6 w-16 rounded-full" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Skeleton, { className: "h-7 w-24" }), _jsx(Skeleton, { className: "h-4 w-32" })] })] }) }, `stat-skeleton-${index}`)))
        : stats.map((stat) => (_jsx(Card, { className: "transition-shadow duration-200 hover:shadow-lg", "data-testid": "dashboard-stat-card", children: _jsxs(CardContent, { className: "space-y-4 p-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("div", { className: cn('flex items-center justify-center rounded-lg p-2', statIconStyles[stat.color]), children: _jsx(stat.icon, { className: "h-5 w-5" }) }), _jsx(Badge, { className: changeBadgeVariants[stat.trend] ?? changeBadgeVariants.neutral, children: stat.change })] }), _jsxs("div", { className: "space-y-1", children: [_jsx("h3", { className: "text-2xl font-semibold text-foreground", children: stat.value }), _jsx("p", { className: "text-sm text-muted-foreground", children: stat.title })] })] }) }, stat.id))) }));
export const DashboardStatsWidget = memo(DashboardStatsWidgetComponent);
