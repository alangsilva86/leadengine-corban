import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer.jsx';
import { cn } from '@/lib/utils.js';
import { formatMetricValue } from '../lib/formatting';
import SelectedInstanceBanner from './SelectedInstanceBanner.jsx';
import InstanceFiltersBar from './InstanceFiltersBar.jsx';
import InstanceGrid from './InstanceGrid.jsx';
import { AlertCircle } from 'lucide-react';
import useInstanceMetrics from '../hooks/useInstanceMetrics';
const STATUS_FILTERS = [
    { value: 'all', label: 'Todas' },
    { value: 'connected', label: 'Conectadas' },
    { value: 'reconnecting', label: 'Reconectando' },
    { value: 'attention', label: 'Atenção' },
    { value: 'disconnected', label: 'Desconectadas' },
];
const HEALTH_FILTERS = [
    { value: 'all', label: 'Saúde (todas)' },
    { value: 'alta', label: 'Saúde alta' },
    { value: 'media', label: 'Saúde média' },
    { value: 'baixa', label: 'Saúde baixa' },
];
const SORT_OPTIONS = [
    { value: 'health', label: 'Saúde (default)' },
    { value: 'name', label: 'Nome' },
    { value: 'updated', label: 'Última atualização' },
    { value: 'load', label: 'Carga (fila/15min)' },
];
const InstancesPanel = ({ surfaceStyles: _surfaceStyles, selectedInstance, selectedInstanceStatusInfo, selectedInstancePhone, instancesReady, hasHiddenInstances, hasRenderableInstances, instanceViewModels, showFilterNotice, instancesCountLabel, errorState, isBusy, isAuthenticated, loadingInstances, copy, localStatus, onMarkConnected, onRefresh, onCreateInstance, onShowAll, onRetry, onSelectInstance, onViewQr, onRequestDelete, deletingInstanceId, statusCodeMeta, onViewLogs, onRenameInstance, qrStatusMessage, countdownMessage, canContinue, canCreateCampaigns, createInstanceDisabled = false, createInstanceWarning = null, }) => {
    const [statusDrawerTarget, setStatusDrawerTarget] = useState(null);
    const [healthDrawerTarget, setHealthDrawerTarget] = useState(null);
    const normalizedStatusMeta = Array.isArray(statusCodeMeta) ? statusCodeMeta : [];
    const { enrichedInstances, filteredInstances, providerOptions, summary, searchTerm, setSearchTerm, statusFilter, setStatusFilter, healthFilter, setHealthFilter, providerFilter, setProviderFilter, sortBy, setSortBy, filtersApplied, activeInstances, handleClearFilters, } = useInstanceMetrics({ instanceViewModels, instancesReady });
    const zeroInstances = summary.state === 'empty';
    const allDisconnected = summary.total > 0 && summary.totals.connected === 0;
    const highQueue = summary.queueTotal > 100;
    const statusDrawerData = statusDrawerTarget
        ? {
            meta: normalizedStatusMeta,
            metrics: statusDrawerTarget.statusValues ?? {},
            displayName: statusDrawerTarget.displayName,
        }
        : null;
    const healthDrawerData = healthDrawerTarget
        ? {
            displayName: healthDrawerTarget.displayName,
            metrics: healthDrawerTarget.metrics,
            queueSize: healthDrawerTarget.queueSize,
            failureCount: healthDrawerTarget.failureCount,
            usagePercentage: healthDrawerTarget.usagePercentage,
            relativeUpdated: healthDrawerTarget.relativeUpdated,
            healthScore: healthDrawerTarget.healthScore,
        }
        : null;
    const selectedInstanceInsights = useMemo(() => {
        if (!selectedInstance)
            return null;
        const match = enrichedInstances.find((item) => item.instance?.id === selectedInstance.id);
        if (!match)
            return null;
        return {
            healthScore: match.healthScore,
            healthCategory: match.healthCategory,
            relativeUpdated: match.relativeUpdated,
            queueSize: match.queueSize,
            failureCount: match.failureCount,
            connectionState: match.connectionState,
        };
    }, [enrichedInstances, selectedInstance]);
    const readinessChecklist = useMemo(() => {
        const normalizedConnection = localStatus === 'connected'
            ? 'done'
            : localStatus === 'connecting'
                ? 'progress'
                : selectedInstanceInsights?.connectionState === 'connected'
                    ? 'done'
                    : selectedInstanceInsights?.connectionState === 'attention'
                        ? 'progress'
                        : 'todo';
        const healthScore = selectedInstanceInsights?.healthScore ?? null;
        const healthState = healthScore === null ? 'todo' : healthScore >= 70 ? 'done' : healthScore >= 40 ? 'progress' : 'todo';
        const healthLabel = healthScore === null
            ? 'Sem leituras recentes.'
            : `Saúde ${healthScore}% (${selectedInstanceInsights?.healthCategory ?? '—'})`;
        const inboxState = canContinue ? 'done' : normalizedConnection === 'todo' ? 'todo' : 'progress';
        return [
            {
                key: 'connection',
                label: 'Conexão segura',
                state: normalizedConnection,
                meta: selectedInstanceStatusInfo?.label ?? 'Selecione um canal conectado',
            },
            {
                key: 'health',
                label: 'Canal estável',
                state: healthState,
                meta: healthLabel,
            },
            {
                key: 'inbox',
                label: 'Pronto para Inbox',
                state: inboxState,
                meta: canContinue ? 'Você pode abrir a Inbox sem bloqueios.' : 'Finalize a conexão para liberar as ações.',
            },
        ];
    }, [canContinue, localStatus, selectedInstanceInsights, selectedInstanceStatusInfo?.label]);
    const daySummaryCards = useMemo(() => {
        return [
            {
                key: 'connected',
                label: 'Canais ativos',
                value: `${summary.totals.connected}/${summary.total}`,
                meta: summary.totals.attention > 0
                    ? `${summary.totals.attention} pedem atenção agora`
                    : 'Todos saudáveis',
                tone: summary.totals.connected > 0 ? 'success' : 'warning',
            },
            {
                key: 'queue',
                label: 'Fila (15min)',
                value: formatMetricValue(summary.queueTotal),
                meta: summary.queueTotal > 100 ? 'Elevada nas últimas 2h' : 'Dentro do limite esperado',
                tone: summary.queueTotal > 100 ? 'warning' : 'default',
            },
            {
                key: 'failures',
                label: 'Falhas 24h',
                value: formatMetricValue(summary.failureTotal),
                meta: summary.failureTotal > 0 ? 'Revise alertas críticos' : 'Sem falhas relevantes',
                tone: summary.failureTotal > 0 ? 'warning' : 'success',
            },
            {
                key: 'health',
                label: 'Saúde média',
                value: `${summary.healthScore}%`,
                meta: summary.healthScore >= 70 ? 'Pronto para campanha' : 'Avalie canais em alerta',
                tone: summary.healthScore >= 70 ? 'success' : summary.healthScore >= 40 ? 'warning' : 'destructive',
            },
            {
                key: 'sync',
                label: 'Última sync',
                value: summary.lastSyncLabel,
                meta: 'Referência do dado mais recente',
                tone: 'default',
            },
        ];
    }, [summary.healthScore, summary.lastSyncLabel, summary.queueTotal, summary.totals.attention, summary.totals.connected, summary.total, summary.failureTotal]);
    const selectedInstanceHealthy = Boolean(selectedInstance && (localStatus === 'connected' || selectedInstanceStatusInfo?.variant === 'success'));
    const journeySteps = [
        { key: 'instances', label: '1. Instâncias', status: 'current' },
        {
            key: 'campaigns',
            label: '2. Campanhas',
            status: selectedInstanceHealthy || canCreateCampaigns ? 'ready' : 'upcoming',
        },
        {
            key: 'inbox',
            label: '3. Inbox',
            status: canContinue ? 'ready' : 'upcoming',
        },
    ];
    return (_jsxs("section", { className: "space-y-6", children: [_jsx(SelectedInstanceBanner, { copy: copy, summary: summary, selectedInstance: selectedInstance, selectedInstanceStatusInfo: selectedInstanceStatusInfo, selectedInstancePhone: selectedInstancePhone, instancesCountLabel: instancesCountLabel, onMarkConnected: onMarkConnected, localStatus: localStatus, onRefresh: onRefresh, onCreateInstance: onCreateInstance, createInstanceDisabled: createInstanceDisabled, createInstanceWarning: createInstanceWarning, onViewLogs: onViewLogs, loadingInstances: loadingInstances, isAuthenticated: isAuthenticated, qrStatusMessage: qrStatusMessage, countdownMessage: countdownMessage, journeySteps: journeySteps, canContinue: canContinue, readinessChecklist: readinessChecklist }), _jsxs("div", { className: "rounded-3xl border border-slate-800/70 bg-slate-950/70 p-4 shadow-[0_16px_50px_rgba(15,23,42,0.45)]", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [_jsxs("div", { className: "space-y-1", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-wide text-foreground", children: "Resumo r\u00E1pido do dia" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Foque onde o vendedor ganha tempo e evita bloqueios." })] }), _jsx(Badge, { variant: "outline", className: "rounded-full border-slate-800/80 bg-slate-900 px-3 py-1 text-[0.65rem] uppercase tracking-wide text-muted-foreground", children: instancesReady ? `Atualizado ${summary.lastSyncLabel}` : 'Sincronizando painéis' })] }), _jsx("div", { className: "mt-4 grid gap-2 md:grid-cols-3 xl:grid-cols-5", children: instancesReady
                            ? daySummaryCards.map((card) => {
                                const toneClass = card.tone === 'success'
                                    ? 'border-emerald-500/30 bg-emerald-500/5'
                                    : card.tone === 'warning'
                                        ? 'border-amber-500/30 bg-amber-500/5'
                                        : card.tone === 'destructive'
                                            ? 'border-rose-500/30 bg-rose-500/5'
                                            : 'border-slate-800/70 bg-slate-950/60';
                                return (_jsxs("div", { className: cn('rounded-2xl border px-4 py-3 text-sm text-muted-foreground transition hover:border-indigo-400/40 hover:bg-slate-900/70', toneClass), children: [_jsx("p", { className: "text-[0.65rem] uppercase tracking-wide text-slate-400", children: card.label }), _jsx("p", { className: "text-lg font-semibold text-foreground", children: card.value }), _jsx("p", { className: "text-[0.75rem] text-muted-foreground", children: card.meta })] }, card.key));
                            })
                            : Array.from({ length: 5 }).map((_, index) => (_jsxs("div", { className: "rounded-2xl border border-slate-800/70 bg-slate-950/60 p-3", children: [_jsx(Skeleton, { className: "h-3 w-16" }), _jsx(Skeleton, { className: "mt-2 h-4 w-12" }), _jsx(Skeleton, { className: "mt-2 h-3 w-24" })] }, index))) })] }), _jsx("div", { className: "rounded-3xl border border-slate-800/70 bg-slate-950/70 p-6 shadow-[0_16px_50px_rgba(15,23,42,0.45)]", children: _jsxs("div", { className: "space-y-6", children: [_jsx(InstanceFiltersBar, { searchTerm: searchTerm, onSearchChange: setSearchTerm, statusFilter: statusFilter, onStatusFilterChange: setStatusFilter, statusOptions: STATUS_FILTERS, healthFilter: healthFilter, onHealthFilterChange: setHealthFilter, healthOptions: HEALTH_FILTERS, providerFilter: providerFilter, onProviderFilterChange: setProviderFilter, providerOptions: providerOptions, sortBy: sortBy, onSortByChange: setSortBy, sortOptions: SORT_OPTIONS, activeInstances: activeInstances, totalInstances: summary.total, filtersApplied: filtersApplied, onClearFilters: handleClearFilters }), showFilterNotice ? (_jsx("div", { className: "rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200", children: "Mostrando apenas inst\u00E2ncias conectadas. Utilize os filtros para incluir sess\u00F5es desconectadas." })) : null, createInstanceWarning ? (_jsx("div", { className: "rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200", children: createInstanceWarning })) : null, _jsx(InstanceGrid, { instancesReady: instancesReady, filteredInstances: filteredInstances, statusCodeMeta: statusCodeMeta, isBusy: isBusy, isAuthenticated: isAuthenticated, deletingInstanceId: deletingInstanceId, hasRenderableInstances: hasRenderableInstances, hasHiddenInstances: hasHiddenInstances, zeroInstances: zeroInstances, onShowAll: onShowAll, onCreateInstance: onCreateInstance, createInstanceDisabled: createInstanceDisabled, createInstanceWarning: createInstanceWarning, onSelectInstance: onSelectInstance, onViewQr: onViewQr, onRequestDelete: onRequestDelete, onOpenStatusDrawer: setStatusDrawerTarget, onOpenHealthDrawer: setHealthDrawerTarget, onRenameInstance: onRenameInstance, onViewLogs: onViewLogs, highQueue: highQueue, allDisconnected: allDisconnected, onClearFilters: handleClearFilters })] }) }), errorState ? (_jsxs("div", { className: "flex flex-wrap items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-100", children: [_jsx(AlertCircle, { className: "mt-0.5 h-5 w-5" }), _jsxs("div", { className: "flex-1 space-y-1", children: [_jsx("p", { className: "font-semibold", children: errorState.title ?? 'Algo deu errado' }), _jsx("p", { className: "text-rose-100/80", children: errorState.message })] }), _jsx("div", { children: _jsx(Button, { size: "sm", variant: "outline", onClick: onRetry, children: "Tentar novamente" }) })] })) : null, _jsx(Drawer, { open: Boolean(statusDrawerTarget), onOpenChange: (open) => {
                    if (!open) {
                        setStatusDrawerTarget(null);
                    }
                }, direction: "right", children: _jsxs(DrawerContent, { className: "w-full bg-slate-950 text-slate-100 sm:max-w-md", children: [_jsxs(DrawerHeader, { children: [_jsx(DrawerTitle, { children: "Status da inst\u00E2ncia" }), _jsxs(DrawerDescription, { children: ["C\u00F3digos recentes para ", statusDrawerData?.displayName] })] }), _jsx("div", { className: "space-y-4 px-4 pb-6", children: statusDrawerData ? (statusDrawerData.meta.map((meta) => {
                                const value = statusDrawerData.metrics?.[meta.code] ?? 0;
                                return (_jsxs("div", { className: "rounded-xl border border-slate-800/70 bg-slate-900/60 p-4", children: [_jsxs("div", { className: "flex items-center justify-between text-sm", children: [_jsxs("div", { children: [_jsxs("p", { className: "text-sm font-semibold", children: ["C\u00F3digo ", meta.label] }), _jsx("p", { className: "text-xs text-slate-400", children: meta.description })] }), _jsx("span", { className: "text-lg font-semibold text-foreground", children: formatMetricValue(value) })] }), _jsx(Button, { size: "sm", variant: "ghost", className: "mt-3 h-8 px-2 text-xs uppercase", onClick: () => {
                                                onViewLogs?.(statusDrawerTarget?.instance ?? statusDrawerTarget);
                                            }, children: "Ver no log" })] }, meta.code));
                            })) : (_jsx("p", { className: "text-sm text-muted-foreground", children: "Nenhum dado de status dispon\u00EDvel." })) }), _jsx("div", { className: "px-4 pb-4", children: _jsx(DrawerClose, { asChild: true, children: _jsx(Button, { variant: "outline", size: "sm", className: "w-full", children: "Fechar" }) }) })] }) }), _jsx(Drawer, { open: Boolean(healthDrawerTarget), onOpenChange: (open) => {
                    if (!open) {
                        setHealthDrawerTarget(null);
                    }
                }, direction: "right", children: _jsxs(DrawerContent, { className: "w-full bg-slate-950 text-slate-100 sm:max-w-md", children: [_jsxs(DrawerHeader, { children: [_jsx(DrawerTitle, { children: "Sa\u00FAde do canal" }), _jsx(DrawerDescription, { children: healthDrawerData?.displayName })] }), healthDrawerData ? (_jsxs("div", { className: "space-y-4 px-4 pb-6", children: [_jsxs("div", { className: "rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4", children: [_jsx("p", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Health score" }), _jsx("p", { className: "mt-2 text-3xl font-semibold text-foreground", children: healthDrawerData.healthScore }), _jsxs("p", { className: "mt-1 text-xs text-slate-400", children: ["Atualizado ", healthDrawerData.relativeUpdated] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { className: "rounded-xl border border-slate-800/70 bg-slate-900/60 p-4", children: [_jsx("p", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Fila" }), _jsx("p", { className: "mt-1 text-lg font-semibold text-foreground", children: formatMetricValue(healthDrawerData.queueSize) })] }), _jsxs("div", { className: "rounded-xl border border-slate-800/70 bg-slate-900/60 p-4", children: [_jsx("p", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Falhas 24h" }), _jsx("p", { className: "mt-1 text-lg font-semibold text-foreground", children: formatMetricValue(healthDrawerData.failureCount) })] })] }), _jsxs("div", { className: "rounded-xl border border-slate-800/70 bg-slate-900/60 p-4", children: [_jsx("p", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Utiliza\u00E7\u00E3o do limite" }), _jsx("div", { className: "mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800", children: _jsx("div", { className: cn('h-full rounded-full transition-all', healthDrawerData.usagePercentage >= 80 ? 'bg-rose-500' : 'bg-indigo-500'), style: { width: `${Math.max(0, Math.min(100, healthDrawerData.usagePercentage))}%` } }) }), _jsxs("p", { className: "mt-2 text-sm text-slate-300", children: ["Uso atual: ", healthDrawerData.usagePercentage, "%"] })] }), _jsxs("div", { className: "rounded-xl border border-slate-800/70 bg-slate-900/60 p-4", children: [_jsx("p", { className: "text-xs uppercase tracking-wide text-slate-400", children: "A\u00E7\u00F5es r\u00E1pidas" }), _jsxs("div", { className: "mt-3 grid gap-2", children: [_jsx(Button, { size: "sm", variant: "secondary", onClick: () => onRefresh?.(), children: "For\u00E7ar sync" }), _jsx(Button, { size: "sm", variant: "outline", onClick: () => onViewLogs?.(healthDrawerTarget?.instance ?? healthDrawerTarget), children: "Ver mensagens recentes" })] })] })] })) : (_jsx("div", { className: "px-4 pb-6 text-sm text-muted-foreground", children: "Nenhum dado dispon\u00EDvel." })), _jsx("div", { className: "px-4 pb-4", children: _jsx(DrawerClose, { asChild: true, children: _jsx(Button, { variant: "outline", size: "sm", className: "w-full", children: "Fechar" }) }) })] }) })] }));
};
export default InstancesPanel;
