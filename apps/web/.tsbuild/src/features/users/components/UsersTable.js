import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from '@/components/ui/alert-dialog.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from '@/components/ui/table.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Switch } from '@/components/ui/switch.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import UserRoleBadge from './UserRoleBadge';
import UserStatusBadge from './UserStatusBadge';
const formatDateTime = (value) => {
    if (!value) {
        return 'Nunca acessou';
    }
    try {
        return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
    }
    catch {
        return value;
    }
};
const roleOptions = [
    { value: 'ADMIN', label: 'Administrador' },
    { value: 'SUPERVISOR', label: 'Supervisor' },
    { value: 'AGENT', label: 'Agente' },
];
const UsersTable = ({ users, onRoleChange, onToggleActive, onRemove, busyUserIds = [], currentUserId, }) => {
    const [pendingRemoval, setPendingRemoval] = useState(null);
    const busySet = useMemo(() => new Set(busyUserIds), [busyUserIds]);
    const handleConfirmRemoval = () => {
        if (!pendingRemoval) {
            return;
        }
        onRemove(pendingRemoval);
        setPendingRemoval(null);
    };
    if (!users.length) {
        return (_jsx("div", { className: "rounded-md border border-dashed border-border/80 p-8 text-center text-sm text-muted-foreground", children: "Nenhum usu\u00E1rio encontrado para o filtro selecionado." }));
    }
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: "overflow-x-auto rounded-lg border border-border/60", children: _jsxs(Table, { children: [_jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { className: "min-w-[220px]", children: "Operador" }), _jsx(TableHead, { className: "min-w-[180px]", children: "Fun\u00E7\u00E3o" }), _jsx(TableHead, { children: "Status" }), _jsx(TableHead, { children: "\u00DAltimo acesso" }), _jsx(TableHead, { className: "text-right", children: "A\u00E7\u00F5es" })] }) }), _jsx(TableBody, { children: users.map((user) => {
                                const busy = busySet.has(user.id);
                                const disableRemoval = !user.isActive || user.id === currentUserId;
                                return (_jsxs(TableRow, { "data-testid": "users-table-row", children: [_jsx(TableCell, { children: _jsxs("div", { className: "flex flex-col", children: [_jsxs("div", { className: "flex items-center gap-2 font-medium text-foreground", children: [user.name, busy ? _jsx(Loader2, { className: "h-3.5 w-3.5 animate-spin text-muted-foreground" }) : null] }), _jsx("span", { className: "text-sm text-muted-foreground", children: user.email })] }) }), _jsx(TableCell, { children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsxs(Select, { value: user.role, onValueChange: (value) => onRoleChange(user.id, value), disabled: busy, children: [_jsx(SelectTrigger, { "aria-label": `Alterar função de ${user.name}`, className: "w-[180px]", children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: roleOptions.map((option) => (_jsx(SelectItem, { value: option.value, children: option.label }, option.value))) })] }), _jsx(UserRoleBadge, { role: user.role })] }) }), _jsx(TableCell, { children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsx(Switch, { checked: user.isActive, onCheckedChange: (value) => onToggleActive(user.id, value), disabled: busy || user.id === currentUserId, "aria-label": `Alternar status de ${user.name}` }), _jsx(UserStatusBadge, { isActive: user.isActive })] }) }), _jsx(TableCell, { children: _jsx(Badge, { variant: "outline", children: formatDateTime(user.lastLoginAt) }) }), _jsx(TableCell, { className: "text-right", children: _jsx(Button, { type: "button", variant: "ghost", size: "icon", onClick: () => setPendingRemoval(user.id), disabled: disableRemoval || busy, "aria-label": `Desativar ${user.name}`, children: _jsx(Trash2, { className: "h-4 w-4" }) }) })] }, user.id));
                            }) })] }) }), _jsx(AlertDialog, { open: Boolean(pendingRemoval), onOpenChange: (open) => (!open ? setPendingRemoval(null) : null), children: _jsxs(AlertDialogContent, { children: [_jsxs(AlertDialogHeader, { children: [_jsx(AlertDialogTitle, { children: "Deseja desativar este usu\u00E1rio?" }), _jsx(AlertDialogDescription, { children: "O operador perder\u00E1 o acesso imediatamente. Voc\u00EA pode reativ\u00E1-lo a qualquer momento alterando o status para ativo." })] }), _jsxs(AlertDialogFooter, { children: [_jsx(AlertDialogCancel, { children: "Cancelar" }), _jsx(AlertDialogAction, { onClick: handleConfirmRemoval, children: "Desativar" })] })] }) })] }));
};
export default UsersTable;
