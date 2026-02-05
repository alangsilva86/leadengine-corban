import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { Loader2, Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Separator } from '@/components/ui/separator.jsx';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { useCreateUserMutation, useDeactivateUserMutation, useUpdateUserMutation, useUsersQuery, } from '../hooks/useUsersApi';
import UsersTable from './UsersTable';
import CreateUserDialog from './CreateUserDialog';
const filterOptions = [
    { label: 'Ativos', value: 'active' },
    { label: 'Inativos', value: 'inactive' },
    { label: 'Todos', value: 'all' },
];
const readErrorMessage = (error, fallback = 'Não foi possível completar a ação.') => {
    if (!error) {
        return fallback;
    }
    if (error instanceof Error) {
        return error.message || fallback;
    }
    if (typeof error === 'object' && 'payload' in error) {
        const payloadError = error.payload?.error?.message;
        if (payloadError) {
            return payloadError;
        }
    }
    return fallback;
};
const UsersSettingsTab = () => {
    const [statusFilter, setStatusFilter] = useState('active');
    const [createOpen, setCreateOpen] = useState(false);
    const usersQuery = useUsersQuery(statusFilter);
    const createMutation = useCreateUserMutation();
    const updateMutation = useUpdateUserMutation();
    const deactivateMutation = useDeactivateUserMutation();
    const busyUserIds = useMemo(() => {
        const ids = new Set();
        if (updateMutation.isPending && updateMutation.variables?.userId) {
            ids.add(updateMutation.variables.userId);
        }
        if (deactivateMutation.isPending && deactivateMutation.variables?.userId) {
            ids.add(deactivateMutation.variables.userId);
        }
        return Array.from(ids);
    }, [updateMutation.isPending, updateMutation.variables, deactivateMutation.isPending, deactivateMutation.variables]);
    const users = usersQuery.data ?? [];
    const handleRoleChange = (userId, nextRole) => {
        const target = users.find((item) => item.id === userId);
        if (!target || target.role === nextRole) {
            return;
        }
        updateMutation.mutate({ userId, role: nextRole }, {
            onSuccess: () => {
                toast.success('Função atualizada.');
            },
            onError: (error) => {
                toast.error(readErrorMessage(error, 'Não foi possível atualizar a função.'));
            },
        });
    };
    const handleToggleStatus = (userId, isActive) => {
        updateMutation.mutate({ userId, isActive }, {
            onSuccess: () => {
                toast.success(`Usuário ${isActive ? 'reativado' : 'desativado'}.`);
            },
            onError: (error) => {
                toast.error(readErrorMessage(error, 'Falha ao alterar status do usuário.'));
            },
        });
    };
    const handleDeactivate = (userId) => {
        deactivateMutation.mutate({ userId }, {
            onSuccess: () => {
                toast.success('Usuário desativado.');
            },
            onError: (error) => {
                toast.error(readErrorMessage(error, 'Não foi possível desativar o usuário.'));
            },
        });
    };
    const handleCreateSubmit = (payload) => {
        createMutation.mutate(payload, {
            onSuccess: () => {
                toast.success('Usuário criado com sucesso.');
                setCreateOpen(false);
            },
            onError: (error) => {
                toast.error(readErrorMessage(error, 'Não foi possível criar o usuário.'));
            },
        });
    };
    const pending = usersQuery.isLoading;
    const isFetching = usersQuery.isFetching && !usersQuery.isLoading;
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs(Card, { children: [_jsxs(CardHeader, { className: "flex flex-row items-center justify-between gap-4", children: [_jsxs("div", { className: "space-y-1", children: [_jsx(CardTitle, { children: "Equipe do workspace" }), _jsx(CardDescription, { children: "Gerencie usu\u00E1rios internos, roles e convites com poucos cliques." })] }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsxs(Button, { variant: "outline", onClick: () => usersQuery.refetch(), disabled: usersQuery.isFetching, children: [_jsx(RefreshCw, { className: "mr-2 h-4 w-4" }), " Atualizar"] }), _jsxs(Button, { onClick: () => setCreateOpen(true), children: [_jsx(Plus, { className: "mr-2 h-4 w-4" }), " Novo usu\u00E1rio"] })] })] }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [_jsx(ToggleGroup, { type: "single", value: statusFilter, onValueChange: (value) => value && setStatusFilter(value), variant: "outline", children: filterOptions.map((option) => (_jsx(ToggleGroupItem, { value: option.value, "aria-label": `Filtrar ${option.label}`, children: option.label }, option.value))) }), _jsxs(Badge, { variant: "secondary", children: [users.length, " usu\u00E1rios"] })] }), _jsx(Separator, {}), pending ? (_jsxs("div", { className: "space-y-3", children: [_jsx(Skeleton, { className: "h-12 w-full" }), _jsx(Skeleton, { className: "h-12 w-full" }), _jsx(Skeleton, { className: "h-12 w-full" })] })) : (_jsx(UsersTable, { users: users, onRoleChange: handleRoleChange, onToggleActive: handleToggleStatus, onRemove: handleDeactivate, busyUserIds: busyUserIds, currentUserId: currentUser?.id })), isFetching && !pending ? (_jsxs("div", { className: "flex items-center gap-2 text-xs text-muted-foreground", children: [_jsx(Loader2, { className: "h-3.5 w-3.5 animate-spin" }), " Atualizando lista\u2026"] })) : null] })] }), _jsx(CreateUserDialog, { open: createOpen, onOpenChange: setCreateOpen, onSubmit: handleCreateSubmit, submitting: createMutation.isPending })] }));
};
export default UsersSettingsTab;
