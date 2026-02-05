import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { MessageSquare, Phone, Mail, Calendar, MoreVertical, Sparkles, AlertCircle, } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Progress } from '@/components/ui/progress.jsx';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { cn } from '@/lib/utils.js';
import { useDashboardData } from './dashboard/useDashboardData';
import { DashboardStatsWidget } from './dashboard/widgets/DashboardStatsWidget';
import { TicketsDailyWidget } from './dashboard/widgets/TicketsDailyWidget';
import { ChannelDistributionWidget } from './dashboard/widgets/ChannelDistributionWidget';
const getStatusBadge = (status) => {
    const variants = {
        open: 'destructive',
        pending: 'secondary',
        resolved: 'default',
    };
    return variants[status] || 'secondary';
};
const getPriorityColor = (priority) => {
    const colors = {
        high: 'text-error',
        medium: 'text-warning',
        low: 'text-success',
    };
    return colors[priority] || 'text-muted-foreground';
};
const getChannelIcon = (channel) => {
    const icons = {
        whatsapp: MessageSquare,
        email: Mail,
        phone: Phone,
        chat: MessageSquare,
        sms: MessageSquare,
        social: Sparkles,
        other: MessageSquare,
    };
    const Icon = icons[channel] || MessageSquare;
    return _jsx(Icon, { className: "h-4 w-4" });
};
const getOnboardingProgress = (onboarding) => {
    if (!onboarding?.stages?.length) {
        return {
            currentIndex: 0,
            total: 0,
            progressValue: 0,
            displayIndex: 0,
            nextStage: null,
            isComplete: false,
        };
    }
    const total = onboarding.stages.length;
    const activeStep = typeof onboarding.activeStep === 'number' ? onboarding.activeStep : 0;
    const currentIndex = Math.min(activeStep, total - 1);
    const displayIndex = Math.min(activeStep + 1, total);
    const progressValue = Math.round((displayIndex / total) * 100);
    const hasCampaign = Boolean(onboarding.activeCampaign);
    const isComplete = hasCampaign && currentIndex >= total - 1;
    const nextIndex = Math.min(currentIndex + 1, total - 1);
    const nextStage = isComplete
        ? 'Atenda seus leads na Inbox'
        : onboarding.stages[nextIndex]?.label ?? onboarding.stages[currentIndex]?.label;
    return { currentIndex, total, progressValue, displayIndex, nextStage, isComplete };
};
const heroStyle = {
    background: 'radial-gradient(circle at top left, color-mix(in srgb, var(--primary) 28%, transparent) 0%, transparent 55%), radial-gradient(circle at bottom right, color-mix(in srgb, var(--success) 22%, transparent) 0%, transparent 60%), color-mix(in srgb, var(--surface-overlay-strong) 78%, transparent)',
    boxShadow: '0 24px 60px color-mix(in srgb, var(--color-border) 45%, transparent)',
};
const Dashboard = ({ onboarding, onStart }) => {
    const { stats, ticketsSeries, leadsSeries, channelDistribution, recentTickets, loading, errors, refetchAll, } = useDashboardData();
    const statsLoading = loading.stats;
    const ticketsChartLoading = loading.ticketsChart;
    const leadsChartLoading = loading.leadsChart;
    const channelLoading = loading.channelDistribution;
    const recentTicketsLoading = loading.recentTickets;
    const handleRetry = () => {
        refetchAll();
    };
    const { total, progressValue, displayIndex, nextStage, isComplete } = getOnboardingProgress(onboarding);
    const stageLabel = nextStage || 'Conclua as etapas';
    const hasStarted = Boolean(onboarding?.selectedAgreement || onboarding?.whatsappStatus !== 'disconnected');
    const primaryCtaLabel = hasStarted ? 'Continuar configuração' : 'Conectar meu primeiro número';
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "grid gap-6 rounded-[24px] border border-secondary p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center", style: heroStyle, children: [_jsxs("div", { className: "grid max-w-xl gap-4", children: [_jsx("h1", { className: "text-3xl font-semibold text-foreground", children: "Mudamos a forma de gerar demanda" }), _jsx("p", { className: "text-base leading-relaxed text-muted-foreground", children: "Conecte o n\u00FAmero que j\u00E1 conversa com os clientes, vincule origens comerciais quando necess\u00E1rio e acompanhe a performance das campanhas em tempo real neste painel." }), total ? (_jsxs("div", { className: "space-y-2 rounded-2xl border border-surface-overlay-glass-border bg-surface-overlay-quiet p-4", children: [_jsxs("div", { className: "flex items-center justify-between text-xs uppercase tracking-wide text-inbox-foreground-muted", children: [_jsx("span", { children: "Primeira configura\u00E7\u00E3o" }), _jsxs("span", { children: [displayIndex, " de ", total] })] }), _jsx(Progress, { value: progressValue, className: "h-2" }), _jsxs("p", { className: "text-xs text-muted-foreground", children: [isComplete ? 'Tudo pronto:' : 'Próximo passo:', ' ', _jsx("span", { className: "font-medium text-foreground", children: stageLabel })] })] })) : null, _jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [_jsxs(Button, { size: "lg", onClick: onStart, children: [_jsx(Sparkles, { className: "h-4 w-4" }), primaryCtaLabel] }), _jsxs(Button, { variant: "outline", size: "lg", children: [_jsx(Calendar, { className: "h-4 w-4" }), "Relat\u00F3rio da semana"] })] })] }), onboarding?.stages ? (_jsx("div", { className: "grid min-w-[220px] gap-3 rounded-2xl border border-surface-overlay-glass-border bg-surface-overlay-strong p-4", children: onboarding.stages.map((stage, index) => {
                            const status = index < onboarding.activeStep
                                ? 'done'
                                : index === onboarding.activeStep
                                    ? 'current'
                                    : 'todo';
                            const statusClasses = {
                                done: 'border-success/40 bg-success/15',
                                current: 'border-primary/50 bg-primary/15',
                                todo: 'border-surface-overlay-glass-border bg-surface-overlay-quiet',
                            };
                            const indexClasses = {
                                done: 'border-transparent bg-success text-success-strong-foreground',
                                current: 'border-transparent bg-primary text-primary-foreground',
                                todo: 'border-surface-overlay-glass-border bg-surface-overlay-quiet text-muted-foreground',
                            };
                            return (_jsxs("div", { className: cn('grid grid-cols-[auto,1fr] items-center gap-3 rounded-lg border p-3 text-sm transition-colors', statusClasses[status]), children: [_jsx("span", { className: cn('flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold', indexClasses[status]), children: index + 1 }), _jsxs("div", { children: [_jsx("span", { className: "block font-medium text-foreground", children: stage.label }), _jsx("span", { className: "block text-xs text-muted-foreground", children: status === 'done' ? 'Concluído' : status === 'current' ? 'Próxima etapa' : 'Aguardando' })] })] }, stage.id));
                        }) })) : null] }), errors.length > 0 ? (_jsxs(Alert, { variant: "destructive", className: "border-destructive/40 bg-destructive/10", children: [_jsx(AlertCircle, { className: "h-4 w-4" }), _jsx(AlertTitle, { children: "N\u00E3o foi poss\u00EDvel carregar todos os dados do painel." }), _jsxs(AlertDescription, { children: [errors.map((message, index) => (_jsx("p", { children: message }, index))), _jsx(Button, { size: "sm", variant: "outline", className: "mt-2", onClick: handleRetry, children: "Tentar novamente" })] })] })) : null, _jsx(DashboardStatsWidget, { stats: stats, loading: statsLoading }), _jsxs("div", { className: "grid grid-cols-1 gap-6 lg:grid-cols-2", children: [_jsx(TicketsDailyWidget, { data: ticketsSeries, loading: ticketsChartLoading }), _jsxs(Card, { className: "transition-shadow duration-200 hover:shadow-lg", children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Leads e Convers\u00F5es" }), _jsx(CardDescription, { children: "Evolu\u00E7\u00E3o mensal de leads e taxa de convers\u00E3o" })] }), _jsx(CardContent, { children: leadsChartLoading ? (_jsx(Skeleton, { className: "h-[300px] w-full rounded-lg" })) : (_jsxs(_Fragment, { children: [_jsx(ResponsiveContainer, { width: "100%", height: 300, children: _jsxs(LineChart, { data: leadsSeries, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3" }), _jsx(XAxis, { dataKey: "name" }), _jsx(YAxis, { allowDecimals: false }), _jsx(Tooltip, {}), _jsx(Line, { type: "monotone", dataKey: "leads", stroke: "var(--color-chart-2)", strokeWidth: 2, name: "Leads" }), _jsx(Line, { type: "monotone", dataKey: "conversoes", stroke: "var(--color-success)", strokeWidth: 2, name: "Convers\u00F5es" })] }) }), leadsSeries.every((item) => item.leads === 0 && item.conversoes === 0) ? (_jsx("p", { className: "mt-4 text-sm text-muted-foreground", children: "Ainda n\u00E3o h\u00E1 leads registrados para exibir nesta s\u00E9rie temporal." })) : null] })) })] })] }), _jsxs("div", { className: "grid grid-cols-1 gap-6 lg:grid-cols-3", children: [_jsx(ChannelDistributionWidget, { data: channelDistribution, loading: channelLoading }), _jsxs(Card, { className: "transition-shadow duration-200 hover:shadow-lg lg:col-span-2", children: [_jsx(CardHeader, { children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx(CardTitle, { children: "Tickets Recentes" }), _jsx(CardDescription, { children: "\u00DAltimas atividades de atendimento" })] }), _jsx(Button, { variant: "ghost", size: "sm", disabled: recentTicketsLoading, children: "Ver todos" })] }) }), _jsx(CardContent, { children: recentTicketsLoading ? (_jsx("div", { className: "space-y-4", children: Array.from({ length: 3 }).map((_, index) => (_jsxs("div", { className: "flex animate-pulse items-start justify-between gap-4 rounded-lg border border-border bg-surface-overlay-strong p-4", children: [_jsxs("div", { className: "flex-1 space-y-3", children: [_jsx(Skeleton, { className: "h-4 w-24" }), _jsx(Skeleton, { className: "h-5 w-40" }), _jsx(Skeleton, { className: "h-4 w-56" }), _jsxs("div", { className: "flex items-center gap-4", children: [_jsx(Skeleton, { className: "h-3 w-20" }), _jsx(Skeleton, { className: "h-3 w-16" }), _jsx(Skeleton, { className: "h-3 w-24" })] })] }), _jsx(Skeleton, { className: "h-8 w-8 rounded-full" })] }, `recent-ticket-skeleton-${index}`))) })) : recentTickets.length > 0 ? (_jsx("div", { className: "space-y-4", children: recentTickets.map((ticket, index) => (_jsxs("div", { className: "flex transform items-start justify-between gap-4 rounded-lg border border-border bg-surface-overlay-strong p-4 transition-all duration-200 ease-in-out hover:scale-[1.02] hover:bg-secondary", children: [_jsxs("div", { className: "flex-1 space-y-2", children: [_jsxs("div", { className: "flex items-center gap-2 text-xs text-muted-foreground", children: [_jsx("span", { className: "font-mono", children: ticket.id }), _jsx(Badge, { variant: getStatusBadge(ticket.status), children: ticket.status })] }), _jsx("h4", { className: "text-base font-medium text-foreground", children: ticket.customer }), _jsx("p", { className: "text-sm text-muted-foreground", children: ticket.subject }), _jsxs("div", { className: "flex flex-wrap items-center gap-4 text-xs text-muted-foreground", children: [_jsxs("div", { className: "flex items-center gap-1", children: [getChannelIcon(ticket.channel), _jsx("span", { className: "capitalize", children: ticket.channel })] }), _jsxs("span", { className: cn('font-medium', getPriorityColor(ticket.priority)), children: ["\u25CF ", ticket.priority] }), _jsx("span", { className: "ml-auto text-xs", children: ticket.time })] })] }), _jsx(Button, { variant: "ghost", size: "sm", children: _jsx(MoreVertical, { className: "h-4 w-4" }) })] }, `${ticket.id}-${index}`))) })) : (_jsx("div", { className: "rounded-[var(--radius)] border border-dashed border-border p-6 text-center text-sm text-muted-foreground", children: "Nenhum ticket recente encontrado. Assim que novos atendimentos chegarem, eles aparecer\u00E3o aqui." })) })] })] })] }));
};
export default Dashboard;
