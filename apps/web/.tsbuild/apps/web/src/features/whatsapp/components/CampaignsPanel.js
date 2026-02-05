import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, } from '@/components/ui/card.jsx';
import NoticeBanner from '@/components/ui/notice-banner.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '@/components/ui/select.jsx';
import { Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger, } from '@/components/ui/drawer.jsx';
import { Loader2, Plus, RefreshCcw } from 'lucide-react';
import CampaignCard from './CampaignCard.jsx';
import CampaignGroup from './CampaignGroup.jsx';
import { useCampaignFilters } from '../campaigns/hooks/useCampaignFilters.js';
import { useCampaignGroups } from '../campaigns/hooks/useCampaignGroups.js';
import { ALL_FILTER_VALUE } from '../campaigns/constants.js';
const CampaignsPanel = ({ agreementName, campaigns, loading, error, onRefresh, onCreateClick, onPause, onActivate, onDelete, onReassign, onDisconnect, actionState, selectedInstanceId, canCreateCampaigns = true, selectedAgreementId = null, }) => {
    const hasAgreementContext = Boolean(agreementName);
    const { agreementFilter, availableAgreements, availableInstances, filteredCampaigns, handleAgreementFilterChange, instanceFilter, isFiltered, setInstanceFilter, } = useCampaignFilters({ campaigns, selectedAgreementId });
    const groupedCampaigns = useCampaignGroups(filteredCampaigns);
    const activeFilters = useMemo(() => {
        let count = 0;
        if (agreementFilter !== ALL_FILTER_VALUE)
            count += 1;
        if (instanceFilter !== ALL_FILTER_VALUE)
            count += 1;
        return count;
    }, [agreementFilter, instanceFilter]);
    const { activeCampaigns, totalCampaigns } = useMemo(() => {
        const total = filteredCampaigns.length;
        const active = filteredCampaigns.filter((entry) => entry.status === 'active').length;
        return { activeCampaigns: active, totalCampaigns: total };
    }, [filteredCampaigns]);
    const isProcessing = useCallback((campaignId, type) => Boolean(actionState?.id === campaignId && (!type || actionState.type === type)), [actionState]);
    const renderEmptyState = useCallback(() => (_jsx("div", { className: "rounded-xl border border-dashed border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] p-6 text-center text-sm text-muted-foreground", children: _jsx("p", { children: isFiltered
                ? 'Nenhuma campanha corresponde aos filtros aplicados.'
                : hasAgreementContext
                    ? 'Nenhuma campanha cadastrada para esta origem.'
                    : 'Nenhuma campanha cadastrada até o momento.' }) })), [hasAgreementContext, isFiltered]);
    const resetFilters = useCallback(() => {
        handleAgreementFilterChange(ALL_FILTER_VALUE);
        setInstanceFilter(ALL_FILTER_VALUE);
    }, [handleAgreementFilterChange, setInstanceFilter]);
    const handleCreateClick = useCallback(() => {
        if (!canCreateCampaigns) {
            toast.error('Conecte uma instância ativa para criar campanhas de WhatsApp.');
            return;
        }
        onCreateClick?.();
    }, [canCreateCampaigns, onCreateClick]);
    return (_jsxs(Card, { className: "border border-[var(--border)]/60 bg-[rgba(15,23,42,0.45)]", children: [_jsx(CardHeader, { className: "flex flex-col gap-3", children: _jsxs("div", { className: "flex flex-col gap-2", children: [_jsx(CardTitle, { children: "Painel de campanhas" }), _jsx(CardDescription, { children: agreementName
                                ? `Visão geral das campanhas da origem ${agreementName}, com acesso rápido às demais origens e instâncias.`
                                : 'Visão global de todas as campanhas vinculadas às instâncias de WhatsApp ativas.' }), !canCreateCampaigns ? (_jsx("p", { className: "text-xs text-muted-foreground", children: "Conecte uma inst\u00E2ncia e defina uma origem quando quiser ativar campanhas automatizadas." })) : null] }) }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { className: "sticky top-0 z-[1] space-y-3 rounded-xl border border-[var(--border)]/70 bg-[rgba(15,23,42,0.75)] p-4 backdrop-blur", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2 text-xs", children: [_jsxs(Badge, { variant: "info", children: [activeCampaigns, " ativa(s)"] }), _jsxs(Badge, { variant: "secondary", children: [totalCampaigns, " ", isFiltered ? 'filtrada(s)' : 'no total'] }), activeFilters > 0 ? (_jsxs(Badge, { variant: "outline", className: "text-[0.65rem] uppercase tracking-wide", children: [activeFilters, " filtro(s)"] })) : null] }), _jsxs("div", { className: "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between", children: [_jsx("p", { className: "text-sm text-muted-foreground", children: "Use os atalhos abaixo para criar novas campanhas ou abrir filtros adicionais." }), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsxs(Button, { size: "sm", onClick: handleCreateClick, "aria-disabled": !canCreateCampaigns, children: [_jsx(Plus, { className: "mr-2 h-4 w-4" }), " Nova campanha"] }), _jsxs(Drawer, { children: [_jsx(DrawerTrigger, { asChild: true, children: _jsx(Button, { size: "sm", variant: "outline", children: "Filtros e atualiza\u00E7\u00E3o" }) }), _jsxs(DrawerContent, { className: "pb-6", children: [_jsxs(DrawerHeader, { className: "pb-2", children: [_jsx(DrawerTitle, { children: "Filtrar e atualizar campanhas" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Ajuste a lista ou recarregue os dados conforme necess\u00E1rio." })] }), _jsxs("div", { className: "space-y-4 px-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx("p", { className: "text-xs uppercase tracking-wide text-muted-foreground", children: "Origem" }), _jsxs(Select, { value: agreementFilter, onValueChange: handleAgreementFilterChange, children: [_jsx(SelectTrigger, { children: _jsx(SelectValue, { placeholder: "Todas as origens" }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: ALL_FILTER_VALUE, children: "Todas as origens" }), availableAgreements.map((item) => (_jsx(SelectItem, { value: item.value, children: item.label }, item.value)))] })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("p", { className: "text-xs uppercase tracking-wide text-muted-foreground", children: "Inst\u00E2ncia" }), _jsxs(Select, { value: instanceFilter, onValueChange: setInstanceFilter, children: [_jsx(SelectTrigger, { children: _jsx(SelectValue, { placeholder: "Todas as inst\u00E2ncias" }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: ALL_FILTER_VALUE, children: "Todas as inst\u00E2ncias" }), availableInstances.map((item) => (_jsx(SelectItem, { value: item.value, children: item.label }, item.value)))] })] })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [isFiltered ? (_jsx(Button, { size: "sm", variant: "ghost", onClick: resetFilters, children: "Limpar filtros" })) : null, _jsxs(Button, { size: "sm", variant: "secondary", onClick: onRefresh, disabled: loading, children: [loading ? (_jsx(Loader2, { className: "mr-2 h-4 w-4 animate-spin" })) : (_jsx(RefreshCcw, { className: "mr-2 h-4 w-4" })), "Atualizar lista"] }), _jsx(DrawerClose, { asChild: true, children: _jsx(Button, { size: "sm", variant: "outline", children: "Fechar" }) })] })] })] })] })] })] })] }), _jsx(NoticeBanner, { tone: "info", children: _jsx("p", { children: "Selecione uma inst\u00E2ncia e ative o roteamento para acompanhar suas campanhas." }) }), error ? (_jsx(NoticeBanner, { tone: "error", children: _jsx("p", { children: error }) })) : null, loading && campaigns.length === 0 ? (_jsx("div", { className: "grid gap-3 sm:grid-cols-2", children: Array.from({ length: 2 }).map((_, index) => (_jsx(Skeleton, { className: "h-40 rounded-xl" }, index))) })) : null, !loading && groupedCampaigns.length === 0 ? renderEmptyState() : null, groupedCampaigns.length > 0 ? (_jsx("div", { className: "space-y-6", children: groupedCampaigns.map((group) => (_jsx(CampaignGroup, { agreementId: group.agreementId, count: group.items.length, label: group.label, children: group.items.map((item) => (_jsx(CampaignCard, { campaign: item, isProcessing: isProcessing, onActivate: onActivate, onDelete: onDelete, onDisconnect: onDisconnect, onPause: onPause, onReassign: onReassign, selectedInstanceId: selectedInstanceId }, item.id))) }, group.key))) })) : null] })] }));
};
export default CampaignsPanel;
