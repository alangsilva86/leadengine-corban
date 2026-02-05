import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useMemo, useState } from 'react';
import { Bookmark, ChevronDown, FolderPlus, Loader2, MoreHorizontal, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, } from '@/components/ui/dropdown-menu.jsx';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '@/components/ui/dialog.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '@/components/ui/select.jsx';
const SCOPE_OPTIONS = [
    { value: 'personal', label: 'Pessoal' },
    { value: 'team', label: 'Equipe' },
    { value: 'organization', label: 'Organização' },
];
const EmptySavedViews = () => (_jsx("div", { className: "px-3 py-2 text-sm text-muted-foreground", children: "Nenhuma vis\u00E3o salva." }));
const useViewForm = (initialScope = 'personal') => {
    const [name, setName] = useState('');
    const [scope, setScope] = useState(initialScope);
    const reset = useCallback(() => {
        setName('');
        setScope(initialScope);
    }, [initialScope]);
    return { name, setName, scope, setScope, reset };
};
const SavedViewActions = ({ view, onDelete, deleting, }) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const handleDelete = useCallback(async () => {
        setMenuOpen(false);
        await onDelete(view);
    }, [onDelete, view]);
    return (_jsxs(DropdownMenu, { open: menuOpen, onOpenChange: setMenuOpen, children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsx(Button, { type: "button", variant: "ghost", size: "icon", className: "h-7 w-7 text-muted-foreground", onClick: (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                    }, children: _jsx(MoreHorizontal, { className: "h-3.5 w-3.5" }) }) }), _jsx(DropdownMenuContent, { align: "end", className: "w-40", children: _jsxs(DropdownMenuItem, { onSelect: async (event) => {
                        event.preventDefault();
                        if (deleting)
                            return;
                        await handleDelete();
                    }, disabled: deleting, children: [_jsx(Trash2, { className: "mr-2 h-3.5 w-3.5" }), "Excluir vis\u00E3o"] }) })] }));
};
const CrmSavedViewsMenu = ({ views, activeViewId, filters, onSelect, onSave, onUpdate, onDelete, isSaving, isDeleting, }) => {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [savingExisting, setSavingExisting] = useState(false);
    const form = useViewForm();
    const activeView = useMemo(() => {
        if (!activeViewId) {
            return null;
        }
        return views.find((view) => view.id === activeViewId) ?? null;
    }, [activeViewId, views]);
    const handleSelect = useCallback(async (viewId) => {
        await onSelect(viewId);
    }, [onSelect]);
    const handleSaveNew = useCallback(async () => {
        if (!form.name.trim()) {
            return;
        }
        await onSave({ name: form.name.trim(), scope: form.scope, filters });
        form.reset();
        setDialogOpen(false);
    }, [filters, form, onSave]);
    const handleUpdateActive = useCallback(async () => {
        if (!activeView) {
            return;
        }
        setSavingExisting(true);
        try {
            await onUpdate({ view: activeView, filters });
        }
        finally {
            setSavingExisting(false);
        }
    }, [activeView, filters, onUpdate]);
    const menuLabel = activeView?.name ?? 'Visões salvas';
    return (_jsxs(_Fragment, { children: [_jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsxs(Button, { type: "button", variant: "outline", size: "sm", className: "inline-flex items-center gap-2 rounded-lg border-border/60 bg-background px-3 text-sm", children: [_jsx(Bookmark, { className: "h-4 w-4" }), _jsx("span", { className: "font-medium", children: menuLabel }), _jsx(ChevronDown, { className: "h-4 w-4 text-muted-foreground" })] }) }), _jsxs(DropdownMenuContent, { align: "start", className: "w-64", children: [_jsxs(DropdownMenuLabel, { className: "flex items-center justify-between", children: ["Vis\u00F5es salvas", _jsx(Button, { type: "button", variant: "ghost", size: "icon", className: "h-7 w-7 text-muted-foreground", onClick: () => setDialogOpen(true), children: _jsx(FolderPlus, { className: "h-4 w-4" }) })] }), _jsx(DropdownMenuSeparator, {}), views.length === 0 ? _jsx(EmptySavedViews, {}) : null, views.map((view) => {
                                const isActive = view.id === activeViewId;
                                return (_jsxs(DropdownMenuItem, { className: "flex items-center justify-between gap-2", onSelect: () => handleSelect(view.id), children: [_jsxs("span", { className: "flex flex-1 flex-col", children: [_jsx("span", { className: "text-sm font-medium", children: view.name }), _jsx("span", { className: "text-xs text-muted-foreground", children: SCOPE_OPTIONS.find((option) => option.value === view.scope)?.label ?? view.scope })] }), isActive ? (_jsx(BadgeActive, {})) : (_jsx(SavedViewActions, { view: view, onDelete: onDelete, deleting: isDeleting }))] }, view.id));
                            }), views.length > 0 ? _jsx(DropdownMenuSeparator, {}) : null, _jsx(DropdownMenuItem, { onSelect: () => handleSelect(null), children: "Vis\u00E3o padr\u00E3o" }), activeView ? (_jsxs(DropdownMenuItem, { disabled: savingExisting || isSaving, onSelect: (event) => {
                                    event.preventDefault();
                                    handleUpdateActive();
                                }, children: [savingExisting ? _jsx(Loader2, { className: "mr-2 h-3.5 w-3.5 animate-spin" }) : _jsx(Save, { className: "mr-2 h-3.5 w-3.5" }), "Salvar altera\u00E7\u00F5es"] })) : null] })] }), _jsx(Dialog, { open: dialogOpen, onOpenChange: setDialogOpen, children: _jsxs(DialogContent, { className: "sm:max-w-md", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: "Salvar vis\u00E3o atual" }), _jsx(DialogDescription, { children: "Nomeie a configura\u00E7\u00E3o de filtros atual para acess\u00E1-la rapidamente depois ou compartilhar com a equipe." })] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-sm font-medium text-foreground", children: "Nome da vis\u00E3o" }), _jsx(Input, { value: form.name, onChange: (event) => form.setName(event.target.value), placeholder: "Leads em negocia\u00E7\u00E3o quente", autoFocus: true })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-sm font-medium text-foreground", children: "Escopo" }), _jsxs(Select, { value: form.scope, onValueChange: (value) => form.setScope(value), children: [_jsx(SelectTrigger, { className: "h-10 rounded-lg", children: _jsx(SelectValue, { placeholder: "Selecionar escopo" }) }), _jsx(SelectContent, { children: SCOPE_OPTIONS.map((option) => (_jsx(SelectItem, { value: option.value, children: option.label }, option.value))) })] })] })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: () => setDialogOpen(false), children: "Cancelar" }), _jsxs(Button, { type: "button", onClick: handleSaveNew, disabled: isSaving || !form.name.trim(), children: [isSaving ? _jsx(Loader2, { className: "mr-2 h-4 w-4 animate-spin" }) : null, "Salvar vis\u00E3o"] })] })] }) })] }));
};
const BadgeActive = () => (_jsx("span", { className: "inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-[0.65rem] font-semibold text-primary", children: "Atual" }));
export default CrmSavedViewsMenu;
