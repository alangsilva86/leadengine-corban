import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { Filter, Loader2, RefreshCw, Search, Trash2, X, Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.jsx';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, } from '@/components/ui/dropdown-menu.jsx';
import { cn } from '@/lib/utils.js';
import CrmSavedViewsMenu from './CrmSavedViewsMenu';
import { normalizeCrmFilters } from '../utils/filter-serialization';
const DEFAULT_FILTERS = {
    stages: [],
    owners: [],
    origins: [],
    channels: [],
    score: null,
    dateRange: null,
    inactivityDays: null,
};
const getClearedFilters = () => normalizeCrmFilters(DEFAULT_FILTERS);
const sumFilters = (filters) => {
    let total = 0;
    total += Array.isArray(filters.stages) ? filters.stages.length : 0;
    total += Array.isArray(filters.owners) ? filters.owners.length : 0;
    total += Array.isArray(filters.origins) ? filters.origins.length : 0;
    total += Array.isArray(filters.channels) ? filters.channels.length : 0;
    if (filters.score?.min != null || filters.score?.max != null)
        total += 1;
    if (filters.dateRange?.from || filters.dateRange?.to)
        total += 1;
    if (typeof filters.inactivityDays === 'number' && filters.inactivityDays >= 0)
        total += 1;
    return total;
};
const toggleItem = (collection, value) => {
    const safeList = Array.isArray(collection) ? collection : [];
    return safeList.includes(value) ? safeList.filter((item) => item !== value) : [...safeList, value];
};
const buildBadges = (filters, filterOptions) => {
    const badges = [];
    const mapLabel = (id, options) => options.find((option) => option.id === id)?.label ?? id;
    (filters.stages ?? []).forEach((stageId) => {
        badges.push({ id: `stage:${stageId}`, label: `Etapa: ${mapLabel(stageId, filterOptions.stages)}` });
    });
    (filters.owners ?? []).forEach((ownerId) => {
        badges.push({ id: `owner:${ownerId}`, label: `Dono: ${mapLabel(ownerId, filterOptions.owners)}` });
    });
    (filters.origins ?? []).forEach((originId) => {
        badges.push({ id: `origin:${originId}`, label: `Origem: ${mapLabel(originId, filterOptions.origins)}` });
    });
    (filters.channels ?? []).forEach((channelId) => {
        badges.push({ id: `channel:${channelId}`, label: `Canal: ${mapLabel(channelId, filterOptions.channels)}` });
    });
    if (filters.score?.min != null || filters.score?.max != null) {
        badges.push({
            id: 'score',
            label: `Score: ${filters.score?.min ?? 0} – ${filters.score?.max ?? '∞'}`,
        });
    }
    if (filters.dateRange?.from || filters.dateRange?.to) {
        badges.push({
            id: 'dateRange',
            label: `Datas: ${(filters.dateRange?.from ?? 'início')} → ${(filters.dateRange?.to ?? 'agora')}`,
        });
    }
    if (typeof filters.inactivityDays === 'number' && filters.inactivityDays >= 0) {
        badges.push({
            id: 'inactivityDays',
            label: `Sem atividade há ${filters.inactivityDays} dia(s)`,
        });
    }
    return badges;
};
const formatTotalLabel = (totalCount) => {
    if (typeof totalCount !== 'number') {
        return null;
    }
    const formatted = new Intl.NumberFormat('pt-BR').format(totalCount);
    return `${formatted} ${totalCount === 1 ? 'lead' : 'leads'}`;
};
const CrmToolbar = ({ filters, onFiltersChange, onClearFilters, filterOptions, totalCount, selectedCount = 0, onClearSelection, onBulkAction, bulkActions = [], isBulkProcessing = false, onRefresh, isRefreshing = false, onCreateLead, savedViews, }) => {
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [draftFilters, setDraftFilters] = useState(() => normalizeCrmFilters(filters));
    useEffect(() => {
        if (!filtersOpen) {
            setDraftFilters(normalizeCrmFilters(filters));
        }
    }, [filters, filtersOpen]);
    const totalLabel = useMemo(() => formatTotalLabel(totalCount), [totalCount]);
    const activeBadges = useMemo(() => buildBadges(filters, filterOptions), [filters, filterOptions]);
    const activeFiltersCount = useMemo(() => sumFilters(filters), [filters]);
    const handleApplyFilters = () => {
        setFiltersOpen(false);
        onFiltersChange(normalizeCrmFilters(draftFilters));
    };
    const handleResetFilters = () => {
        const cleared = getClearedFilters();
        setDraftFilters(cleared);
        onFiltersChange(cleared);
        onClearFilters?.();
        setFiltersOpen(false);
    };
    const handleBadgeRemove = (badgeId) => {
        const [type, value] = badgeId.split(':');
        if (!type)
            return;
        const next = { ...filters };
        if (type === 'stage') {
            next.stages = (next.stages ?? []).filter((stageId) => stageId !== value);
        }
        else if (type === 'owner') {
            next.owners = (next.owners ?? []).filter((ownerId) => ownerId !== value);
        }
        else if (type === 'origin') {
            next.origins = (next.origins ?? []).filter((originId) => originId !== value);
        }
        else if (type === 'channel') {
            next.channels = (next.channels ?? []).filter((channelId) => channelId !== value);
        }
        else if (badgeId === 'score') {
            next.score = null;
        }
        else if (badgeId === 'dateRange') {
            next.dateRange = null;
        }
        else if (badgeId === 'inactivityDays') {
            next.inactivityDays = null;
        }
        onFiltersChange(normalizeCrmFilters(next));
    };
    const handleNumberChange = (key, value) => {
        setDraftFilters((current) => ({
            ...current,
            score: {
                min: key === 'min' ? (value ? Number(value) : null) : current.score?.min ?? null,
                max: key === 'max' ? (value ? Number(value) : null) : current.score?.max ?? null,
            },
        }));
    };
    const handleDateChange = (key, value) => {
        setDraftFilters((current) => ({
            ...current,
            dateRange: {
                from: key === 'from' ? (value || null) : current.dateRange?.from ?? null,
                to: key === 'to' ? (value || null) : current.dateRange?.to ?? null,
            },
        }));
    };
    const handleInactivityChange = (value) => {
        setDraftFilters((current) => ({
            ...current,
            inactivityDays: value ? Number(value) : null,
        }));
    };
    const renderSelectionBanner = () => {
        if (selectedCount <= 0) {
            return null;
        }
        return (_jsxs("div", { className: "flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm", children: [_jsxs("span", { children: [selectedCount, " ", selectedCount === 1 ? 'lead selecionado' : 'leads selecionados'] }), onClearSelection ? (_jsx(Button, { type: "button", variant: "ghost", size: "sm", className: "h-7 px-2 text-xs", onClick: onClearSelection, children: "Limpar sele\u00E7\u00E3o" })) : null, bulkActions.length > 0 && onBulkAction ? (_jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsxs(Button, { type: "button", size: "sm", className: "h-7 px-3 text-xs", children: [_jsx(Users, { className: "mr-2 h-3.5 w-3.5" }), "A\u00E7\u00F5es em massa"] }) }), _jsx(DropdownMenuContent, { align: "start", children: bulkActions.map((action) => (_jsx(DropdownMenuItem, { onSelect: () => onBulkAction(action.id), children: action.label }, action.id))) })] })) : null, isBulkProcessing ? _jsx(Loader2, { className: "h-4 w-4 animate-spin text-muted-foreground" }) : null] }));
    };
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [_jsxs("div", { className: "flex min-w-0 flex-1 items-center gap-2", children: [_jsxs("div", { className: "relative min-w-0 flex-1", children: [_jsx(Search, { className: "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" }), _jsx(Input, { value: filters.search ?? '', onChange: (event) => onFiltersChange({
                                            ...filters,
                                            search: event.target.value,
                                        }), placeholder: "Buscar por nome, empresa ou telefone", className: "h-10 w-full rounded-lg border border-border bg-background pl-9 text-sm shadow-none" }), filters.search ? (_jsx(Button, { type: "button", variant: "ghost", size: "icon", className: "absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground", onClick: () => onFiltersChange({
                                            ...filters,
                                            search: '',
                                        }), "aria-label": "Limpar busca", children: _jsx(X, { className: "h-4 w-4" }) })) : null] }), _jsxs(Popover, { open: filtersOpen, onOpenChange: setFiltersOpen, children: [_jsx(PopoverTrigger, { asChild: true, children: _jsxs(Button, { type: "button", variant: "outline", size: "sm", className: "h-10 rounded-lg border-border/60", children: [_jsx(Filter, { className: "mr-2 h-4 w-4" }), "Filtros", activeFiltersCount > 0 ? (_jsx(Badge, { variant: "secondary", className: "ml-2 h-5 rounded-full px-2 text-xs", children: activeFiltersCount })) : null] }) }), _jsx(PopoverContent, { className: "w-[420px] max-w-[90vw] rounded-xl border border-border bg-background p-4 shadow-xl", children: _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx("span", { className: "text-xs font-semibold uppercase text-muted-foreground", children: "Etapa" }), _jsx("div", { className: "flex flex-wrap gap-2", children: filterOptions.stages.map((stage) => {
                                                                const isSelected = draftFilters.stages?.includes(stage.id);
                                                                return (_jsx(Button, { type: "button", variant: isSelected ? 'default' : 'outline', size: "sm", className: cn('h-8 rounded-full border-border/60', isSelected ? 'bg-primary text-primary-foreground' : 'bg-background'), onClick: () => setDraftFilters((current) => ({
                                                                        ...current,
                                                                        stages: toggleItem(current.stages, stage.id),
                                                                    })), children: stage.label }, stage.id));
                                                            }) })] }), _jsxs("div", { className: "grid grid-cols-1 gap-4 sm:grid-cols-2", children: [_jsx(FilterList, { title: "Dono", options: filterOptions.owners, selected: draftFilters.owners ?? [], onToggle: (value) => setDraftFilters((current) => ({
                                                                ...current,
                                                                owners: toggleItem(current.owners, value),
                                                            })) }), _jsx(FilterList, { title: "Origem", options: filterOptions.origins, selected: draftFilters.origins ?? [], onToggle: (value) => setDraftFilters((current) => ({
                                                                ...current,
                                                                origins: toggleItem(current.origins, value),
                                                            })) }), _jsx(FilterList, { title: "Canal", options: filterOptions.channels, selected: draftFilters.channels ?? [], onToggle: (value) => setDraftFilters((current) => ({
                                                                ...current,
                                                                channels: toggleItem(current.channels, value),
                                                            })) }), _jsxs("div", { className: "space-y-2", children: [_jsx("span", { className: "text-xs font-semibold uppercase text-muted-foreground", children: "Score" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Input, { type: "number", inputMode: "numeric", min: 0, placeholder: "m\u00EDn.", value: draftFilters.score?.min ?? '', onChange: (event) => handleNumberChange('min', event.target.value) }), _jsx("span", { className: "text-muted-foreground", children: "\u2013" }), _jsx(Input, { type: "number", inputMode: "numeric", min: 0, placeholder: "m\u00E1x.", value: draftFilters.score?.max ?? '', onChange: (event) => handleNumberChange('max', event.target.value) })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("span", { className: "text-xs font-semibold uppercase text-muted-foreground", children: "Datas" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Input, { type: "date", value: draftFilters.dateRange?.from ?? '', onChange: (event) => handleDateChange('from', event.target.value) }), _jsx("span", { className: "text-muted-foreground", children: "\u2192" }), _jsx(Input, { type: "date", value: draftFilters.dateRange?.to ?? '', onChange: (event) => handleDateChange('to', event.target.value) })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("span", { className: "text-xs font-semibold uppercase text-muted-foreground", children: "Sem atividade" }), _jsx(Input, { type: "number", min: 0, placeholder: "Dias", value: draftFilters.inactivityDays ?? '', onChange: (event) => handleInactivityChange(event.target.value) })] })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs(Button, { type: "button", variant: "ghost", onClick: handleResetFilters, className: "h-9", children: [_jsx(Trash2, { className: "mr-2 h-4 w-4" }), "Limpar filtros"] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Button, { type: "button", variant: "outline", onClick: () => setFiltersOpen(false), children: "Cancelar" }), _jsx(Button, { type: "button", onClick: handleApplyFilters, children: "Aplicar filtros" })] })] })] }) })] }), _jsx(CrmSavedViewsMenu, { views: savedViews.views, activeViewId: savedViews.activeViewId, filters: filters, onSelect: savedViews.selectSavedView, onSave: (payload) => savedViews.createSavedView(payload), onUpdate: ({ view, filters: updatedFilters }) => savedViews.updateSavedView(view, updatedFilters), onDelete: (view) => savedViews.deleteSavedView(view), isSaving: savedViews.isSaving, isDeleting: savedViews.isDeleting }), onRefresh ? (_jsxs(Button, { type: "button", variant: "outline", size: "sm", onClick: onRefresh, disabled: isRefreshing, className: "h-10 rounded-lg", children: [_jsx(RefreshCw, { className: cn('mr-2 h-4 w-4', isRefreshing ? 'animate-spin' : '') }), "Atualizar"] })) : null, onCreateLead ? (_jsxs(Button, { type: "button", size: "sm", className: "h-10 rounded-lg", onClick: onCreateLead, children: [_jsx(Plus, { className: "mr-2 h-4 w-4" }), "Novo lead"] })) : null] }), totalLabel ? _jsxs("span", { className: "text-xs text-muted-foreground", children: ["Exibindo ", totalLabel] }) : null] }), renderSelectionBanner(), activeBadges.length > 0 ? (_jsx("div", { className: "flex flex-wrap items-center gap-2", children: activeBadges.map((badge) => (_jsxs(Badge, { variant: "secondary", className: "flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs", children: [_jsx("span", { children: badge.label }), _jsxs("button", { type: "button", className: "text-muted-foreground transition hover:text-foreground", onClick: () => handleBadgeRemove(badge.id), children: [_jsx(X, { className: "h-3 w-3" }), _jsx("span", { className: "sr-only", children: "Remover filtro" })] })] }, badge.id))) })) : null] }));
};
const FilterList = ({ title, options, selected, onToggle }) => {
    return (_jsxs("div", { className: "space-y-2", children: [_jsx("span", { className: "text-xs font-semibold uppercase text-muted-foreground", children: title }), _jsx("div", { className: "flex flex-wrap gap-2", children: options.map((option) => {
                    const isSelected = selected.includes(option.id);
                    return (_jsx(Button, { type: "button", variant: isSelected ? 'default' : 'outline', size: "sm", className: cn('h-8 rounded-full border-border/60', isSelected ? 'bg-primary text-primary-foreground' : 'bg-background'), onClick: () => onToggle(option.id), children: option.label }, option.id));
                }) })] }));
};
export default CrmToolbar;
