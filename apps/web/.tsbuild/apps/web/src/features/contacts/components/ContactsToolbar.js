import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
import { Filter, Plus, RefreshCw, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, } from '@/components/ui/dropdown-menu.jsx';
import { Badge } from '@/components/ui/badge.jsx';
const STATUS_OPTIONS = [
    { value: 'all', label: 'Todos' },
    { value: 'ACTIVE', label: 'Ativos' },
    { value: 'INACTIVE', label: 'Inativos' },
    { value: 'ARCHIVED', label: 'Arquivados' },
];
const QUICK_FILTERS = [
    { id: 'isBlocked', label: 'Bloqueados' },
    { id: 'hasWhatsapp', label: 'Com WhatsApp' },
];
const ContactsToolbar = ({ searchValue, onSearchChange, filters, onFiltersChange, onClearFilters, selectedCount = 0, onClearSelection, onBulkAction, isBulkProcessing = false, onRefresh, isRefreshing = false, availableTags = [], totalCount, onCreateContact, }) => {
    const activeFilters = useMemo(() => {
        const badges = [];
        if (filters.status && filters.status !== 'all') {
            const statusOption = STATUS_OPTIONS.find((option) => option.value === filters.status);
            if (statusOption) {
                badges.push({ id: `status:${filters.status}`, label: `Status: ${statusOption.label}` });
            }
        }
        if (Array.isArray(filters.tags) && filters.tags.length > 0) {
            filters.tags.forEach((tag) => {
                badges.push({ id: `tag:${tag}`, label: `Tag: ${tag}` });
            });
        }
        if (filters.isBlocked) {
            badges.push({ id: 'isBlocked', label: 'Bloqueados' });
        }
        if (filters.hasWhatsapp) {
            badges.push({ id: 'hasWhatsapp', label: 'Com WhatsApp' });
        }
        if (filters.ownerId) {
            badges.push({ id: 'owner', label: 'Com responsável' });
        }
        return badges;
    }, [filters]);
    const totalLabel = useMemo(() => {
        if (typeof totalCount !== 'number') {
            return null;
        }
        const formatted = new Intl.NumberFormat('pt-BR').format(totalCount);
        return `${formatted} ${totalCount === 1 ? 'contato' : 'contatos'}`;
    }, [totalCount]);
    const handleStatusChange = (status) => {
        onFiltersChange?.({ ...filters, status });
    };
    const handleTagToggle = (tag) => {
        const current = Array.isArray(filters.tags) ? [...filters.tags] : [];
        if (current.includes(tag)) {
            onFiltersChange?.({ ...filters, tags: current.filter((item) => item !== tag) });
        }
        else {
            onFiltersChange?.({ ...filters, tags: [...current, tag] });
        }
    };
    const handleQuickFilterToggle = (key, value) => {
        const isEnabled = value === true;
        onFiltersChange?.({
            ...filters,
            [key]: isEnabled ? true : undefined,
        });
    };
    const handleReset = () => {
        onFiltersChange?.({ status: 'all', tags: [], ownerId: null, isBlocked: undefined, hasWhatsapp: undefined });
        onClearFilters?.();
    };
    const hasFilters = activeFilters.length > 0;
    const hasSelection = selectedCount > 0;
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsxs("div", { className: "flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between", children: [_jsxs("div", { className: "flex flex-1 flex-col gap-2 lg:flex-row lg:items-center lg:gap-3", children: [_jsxs("div", { className: "relative min-w-0 flex-1", children: [_jsx(Search, { className: "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" }), _jsx(Input, { value: searchValue, onChange: (event) => onSearchChange?.(event.target.value), placeholder: "Buscar por nome, telefone ou e-mail", className: "h-9 w-full rounded-lg border border-border bg-background pl-9 text-sm shadow-none", "aria-label": "Buscar contatos" }), searchValue ? (_jsx(Button, { type: "button", variant: "ghost", size: "icon", className: "absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground", onClick: () => onSearchChange?.(''), "aria-label": "Limpar busca", children: _jsx(X, { className: "h-4 w-4" }) })) : null] }), _jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsx(Button, { type: "button", variant: "outline", size: "icon", "aria-label": "Abrir filtros", children: _jsx(Filter, { className: "h-4 w-4" }) }) }), _jsxs(DropdownMenuContent, { align: "start", className: "w-56", children: [_jsx(DropdownMenuLabel, { children: "Status" }), STATUS_OPTIONS.map((option) => (_jsx(DropdownMenuItem, { onSelect: () => handleStatusChange(option.value), className: filters.status === option.value ? 'bg-muted/70' : undefined, children: option.label }, option.value))), _jsx(DropdownMenuSeparator, {}), _jsx(DropdownMenuLabel, { children: "Tags" }), availableTags.length === 0 ? (_jsx(DropdownMenuItem, { disabled: true, children: "Nenhuma tag dispon\u00EDvel" })) : null, availableTags.map((tag) => (_jsx(DropdownMenuCheckboxItem, { checked: Array.isArray(filters.tags) && filters.tags.includes(tag), onCheckedChange: () => handleTagToggle(tag), children: tag }, tag))), _jsx(DropdownMenuSeparator, {}), _jsx(DropdownMenuLabel, { children: "Filtros r\u00E1pidos" }), QUICK_FILTERS.map((filterOption) => (_jsx(DropdownMenuCheckboxItem, { checked: Boolean(filters[filterOption.id]), onCheckedChange: (checked) => handleQuickFilterToggle(filterOption.id, checked), children: filterOption.label }, filterOption.id))), _jsx(DropdownMenuSeparator, {}), _jsx(DropdownMenuItem, { onSelect: handleReset, children: "Limpar filtros" })] })] }), _jsx(Button, { type: "button", variant: "outline", size: "icon", className: "hidden lg:inline-flex", onClick: onRefresh, disabled: isRefreshing, "aria-label": "Recarregar lista", children: _jsx(RefreshCw, { className: `h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}` }) }), totalLabel ? _jsxs("span", { className: "text-xs text-muted-foreground", children: ["Exibindo ", totalLabel] }) : null] }), _jsxs("div", { className: "flex items-center gap-2 self-start", children: [_jsx(Button, { type: "button", variant: "outline", size: "icon", className: "lg:hidden", onClick: onRefresh, disabled: isRefreshing, "aria-label": "Recarregar lista", children: _jsx(RefreshCw, { className: `h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}` }) }), _jsxs(Button, { type: "button", size: "sm", className: "gap-2", onClick: onCreateContact, children: [_jsx(Plus, { className: "h-4 w-4" }), "Novo contato"] })] })] }), hasSelection ? (_jsxs("div", { className: "flex flex-col gap-3 rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 text-sm text-primary sm:flex-row sm:items-center sm:justify-between", children: [_jsx("div", { className: "font-semibold", children: selectedCount === 1 ? '1 contato selecionado' : `${selectedCount} contatos selecionados` }), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx(Button, { type: "button", variant: "ghost", size: "sm", disabled: isBulkProcessing, onClick: onClearSelection, "aria-label": "Limpar sele\u00E7\u00E3o", children: "Limpar sele\u00E7\u00E3o" }), _jsx(Button, { type: "button", variant: "secondary", size: "sm", disabled: isBulkProcessing, onClick: () => onBulkAction?.('mergeDuplicates'), children: "Deduplicar" }), _jsx(Button, { type: "button", variant: "outline", size: "sm", disabled: isBulkProcessing, onClick: () => onBulkAction?.('sendWhatsApp'), children: "Disparar WhatsApp" }), _jsx(Button, { type: "button", variant: "outline", size: "sm", disabled: isBulkProcessing, onClick: () => onBulkAction?.('createTask'), children: "Criar tarefa" })] })] })) : null, hasFilters ? (_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [activeFilters.map((filter) => (_jsxs(Badge, { variant: "secondary", className: "flex items-center gap-1", children: [filter.label, _jsx("button", { type: "button", className: "text-muted-foreground transition hover:text-foreground", onClick: () => {
                                    if (filter.id.startsWith('status:')) {
                                        handleStatusChange('all');
                                        return;
                                    }
                                    if (filter.id.startsWith('tag:')) {
                                        handleTagToggle(filter.id.replace('tag:', ''));
                                        return;
                                    }
                                    if (filter.id === 'isBlocked' || filter.id === 'hasWhatsapp') {
                                        handleQuickFilterToggle(filter.id, false);
                                        return;
                                    }
                                    handleReset();
                                }, "aria-label": `Remover filtro ${filter.label}`, children: _jsx(X, { className: "h-3 w-3" }) })] }, filter.id))), _jsx(Button, { variant: "ghost", size: "sm", onClick: handleReset, className: "text-muted-foreground", children: "Limpar todos" })] })) : totalLabel ? (_jsxs("div", { className: "text-xs text-muted-foreground", children: ["Ajuste os filtros para refinar os ", totalLabel, " dispon\u00EDveis."] })) : null] }));
};
export default ContactsToolbar;
