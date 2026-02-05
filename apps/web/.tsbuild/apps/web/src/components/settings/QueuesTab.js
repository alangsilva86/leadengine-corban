import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from '@/components/ui/alert-dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, } from '@/components/ui/form';
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api';
import { ArrowDown, ArrowUp, Edit, Loader2, Plus, RefreshCw, Trash2, } from 'lucide-react';
const queueFormSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1, 'Informe o nome da fila')
        .max(120, 'O nome pode ter no máximo 120 caracteres'),
    description: z
        .string()
        .max(300, 'A descrição pode ter no máximo 300 caracteres')
        .optional(),
    color: z
        .string()
        .max(32, 'O identificador de cor pode ter no máximo 32 caracteres')
        .optional(),
    isActive: z.boolean().default(true),
    orderIndex: z.coerce.number().int().min(0).optional(),
});
const sanitizePayload = (values) => {
    const payload = {
        name: values.name.trim(),
        isActive: values.isActive,
    };
    if (values.description !== undefined) {
        payload.description = values.description.trim();
    }
    if (values.color !== undefined) {
        payload.color = values.color.trim();
    }
    if (values.orderIndex !== undefined && !Number.isNaN(values.orderIndex)) {
        payload.orderIndex = values.orderIndex;
    }
    return payload;
};
const QueueFormDialog = ({ open, onOpenChange, defaultValues, onSubmit, submitLabel, title, description, loading, }) => {
    const form = useForm({
        resolver: zodResolver(queueFormSchema),
        defaultValues,
        mode: 'onSubmit',
    });
    useEffect(() => {
        if (open) {
            form.reset(defaultValues);
        }
    }, [defaultValues, form, open]);
    const handleSubmit = form.handleSubmit((values) => {
        onSubmit({
            ...values,
            description: values.description ?? '',
            color: values.color ?? '',
        });
    });
    return (_jsx(Dialog, { open: open, onOpenChange: onOpenChange, children: _jsxs(DialogContent, { children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: title }), description ? _jsx(DialogDescription, { children: description }) : null] }), _jsx(Form, { ...form, children: _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsx(FormField, { control: form.control, name: "name", render: ({ field }) => (_jsxs(FormItem, { children: [_jsx(FormLabel, { children: "Nome da fila" }), _jsx(FormControl, { children: _jsx(Input, { placeholder: "Ex.: Atendimento inbound", ...field }) }), _jsx(FormMessage, {})] })) }), _jsx(FormField, { control: form.control, name: "description", render: ({ field }) => (_jsxs(FormItem, { children: [_jsx(FormLabel, { children: "Descri\u00E7\u00E3o" }), _jsx(FormControl, { children: _jsx(Textarea, { placeholder: "Explique como a fila ser\u00E1 utilizada (opcional)", className: "min-h-[100px]", ...field }) }), _jsx(FormMessage, {})] })) }), _jsx(FormField, { control: form.control, name: "color", render: ({ field }) => (_jsxs(FormItem, { children: [_jsx(FormLabel, { children: "Identificador de cor" }), _jsx(FormControl, { children: _jsx(Input, { placeholder: "Ex.: #2563eb ou primary", ...field }) }), _jsx(FormMessage, {})] })) }), _jsxs("div", { className: "grid grid-cols-1 gap-4 sm:grid-cols-2", children: [_jsx(FormField, { control: form.control, name: "orderIndex", render: ({ field }) => (_jsxs(FormItem, { children: [_jsx(FormLabel, { children: "Ordem de exibi\u00E7\u00E3o" }), _jsx(FormControl, { children: _jsx(Input, { type: "number", min: 0, ...field }) }), _jsx(FormMessage, {})] })) }), _jsx(FormField, { control: form.control, name: "isActive", render: ({ field }) => (_jsxs(FormItem, { className: "flex flex-row items-center justify-between rounded-md border border-[color:color-mix(in_srgb,var(--border)_85%,transparent)] bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] p-3 shadow-[0_0_0_1px_color-mix(in_srgb,var(--border)_35%,transparent)]", children: [_jsxs("div", { className: "space-y-0.5", children: [_jsx(FormLabel, { className: "text-base", children: "Fila ativa" }), _jsx(DialogDescription, { className: "text-xs", children: "Fila ficar\u00E1 dispon\u00EDvel para roteamento de tickets." })] }), _jsx(FormControl, { children: _jsx(Switch, { checked: field.value, onCheckedChange: field.onChange }) })] })) })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", disabled: loading, onClick: () => onOpenChange(false), children: "Cancelar" }), _jsxs(Button, { type: "submit", disabled: loading, children: [loading ? _jsx(Loader2, { className: "mr-2 h-4 w-4 animate-spin" }) : null, submitLabel] })] })] }) })] }) }));
};
const QueuesTab = () => {
    const queryClient = useQueryClient();
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingQueue, setEditingQueue] = useState(null);
    const [queueToDelete, setQueueToDelete] = useState(null);
    const queuesQuery = useQuery({
        queryKey: ['settings', 'queues'],
        queryFn: async () => {
            const payload = await apiGet('/api/queues');
            const items = payload?.data?.items ?? payload?.data ?? [];
            return Array.isArray(items) ? items : [];
        },
    });
    const orderedQueues = useMemo(() => {
        return [...(queuesQuery.data ?? [])].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
    }, [queuesQuery.data]);
    const nextOrderIndex = orderedQueues.length;
    const createQueueMutation = useMutation({
        mutationFn: async (values) => {
            const payload = sanitizePayload(values);
            const response = await apiPost('/api/queues', payload);
            return response?.data;
        },
        onSuccess: () => {
            toast.success('Fila criada com sucesso');
            setIsCreateOpen(false);
            void queryClient.invalidateQueries({ queryKey: ['settings', 'queues'] });
        },
        onError: (error) => {
            toast.error('Erro ao criar fila', { description: error?.message });
        },
    });
    const updateQueueMutation = useMutation({
        mutationFn: async ({ id, values }) => {
            const payload = sanitizePayload(values);
            const response = await apiPatch(`/api/queues/${id}`, payload);
            return response?.data;
        },
        onSuccess: () => {
            toast.success('Fila atualizada');
            setEditingQueue(null);
            void queryClient.invalidateQueries({ queryKey: ['settings', 'queues'] });
        },
        onError: (error) => {
            toast.error('Erro ao atualizar fila', { description: error?.message });
        },
    });
    const reorderQueuesMutation = useMutation({
        mutationFn: async (items) => {
            const response = await apiPatch('/api/queues/reorder', { items });
            return response?.data;
        },
        onSuccess: () => {
            toast.success('Ordem atualizada');
            void queryClient.invalidateQueries({ queryKey: ['settings', 'queues'] });
        },
        onError: (error) => {
            toast.error('Não foi possível reordenar', { description: error?.message });
        },
    });
    const deleteQueueMutation = useMutation({
        mutationFn: async (id) => {
            await apiDelete(`/api/queues/${id}`);
        },
        onSuccess: () => {
            toast.success('Fila removida');
            setQueueToDelete(null);
            void queryClient.invalidateQueries({ queryKey: ['settings', 'queues'] });
        },
        onError: (error) => {
            toast.error('Erro ao remover fila', { description: error?.message });
        },
    });
    const handleToggleActive = (queue, nextValue) => {
        updateQueueMutation.mutate({
            id: queue.id,
            values: {
                name: queue.name,
                description: queue.description ?? '',
                color: queue.color ?? '',
                isActive: typeof nextValue === 'boolean' ? nextValue : !queue.isActive,
                orderIndex: queue.orderIndex ?? 0,
            },
        });
    };
    const handleMove = (queue, direction) => {
        const currentIndex = orderedQueues.findIndex((item) => item.id === queue.id);
        if (currentIndex === -1) {
            return;
        }
        const targetIndex = Math.min(Math.max(currentIndex + direction, 0), Math.max(orderedQueues.length - 1, 0));
        if (currentIndex === targetIndex) {
            return;
        }
        const updated = [...orderedQueues];
        const [moved] = updated.splice(currentIndex, 1);
        updated.splice(targetIndex, 0, moved);
        const items = updated.map((item, index) => ({ id: item.id, orderIndex: index }));
        reorderQueuesMutation.mutate(items);
    };
    const queuesLoading = queuesQuery.isLoading || queuesQuery.isFetching;
    const createDefaults = {
        name: '',
        description: '',
        color: '',
        isActive: true,
        orderIndex: nextOrderIndex,
    };
    const editDefaults = editingQueue
        ? {
            name: editingQueue.name ?? '',
            description: editingQueue.description ?? '',
            color: editingQueue.color ?? '',
            isActive: Boolean(editingQueue.isActive),
            orderIndex: editingQueue.orderIndex ?? 0,
        }
        : createDefaults;
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs(Card, { children: [_jsxs(CardHeader, { className: "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between", children: [_jsxs("div", { children: [_jsx(CardTitle, { children: "Filas de atendimento" }), _jsx(CardDescription, { children: "Organize a distribui\u00E7\u00E3o de leads e tickets definindo quais filas estar\u00E3o ativas e em qual ordem." })] }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsxs(Button, { variant: "outline", onClick: () => queuesQuery.refetch(), disabled: queuesLoading, children: [queuesLoading ? _jsx(Loader2, { className: "mr-2 h-4 w-4 animate-spin" }) : _jsx(RefreshCw, { className: "mr-2 h-4 w-4" }), "Atualizar"] }), _jsxs(Button, { onClick: () => setIsCreateOpen(true), children: [_jsx(Plus, { className: "mr-2 h-4 w-4" }), "Nova fila"] })] })] }), _jsx(CardContent, { children: queuesLoading ? (_jsxs("div", { className: "flex items-center justify-center py-12 text-muted-foreground", children: [_jsx(Loader2, { className: "mr-2 h-5 w-5 animate-spin" }), " Carregando filas..."] })) : orderedQueues.length === 0 ? (_jsxs("div", { className: "flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center", children: [_jsx("p", { className: "max-w-md text-sm text-muted-foreground", children: "Nenhuma fila cadastrada. Crie ao menos uma fila ativa para destravar o atendimento inbound na Inbox." }), _jsxs(Button, { onClick: () => setIsCreateOpen(true), children: [_jsx(Plus, { className: "mr-2 h-4 w-4" }), " Criar primeira fila"] })] })) : (_jsxs(Table, { children: [_jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { children: "Nome" }), _jsx(TableHead, { children: "Status" }), _jsx(TableHead, { children: "Ordem" }), _jsx(TableHead, { children: "Descri\u00E7\u00E3o" }), _jsx(TableHead, { className: "text-right", children: "A\u00E7\u00F5es" })] }) }), _jsx(TableBody, { children: orderedQueues.map((queue, index) => (_jsxs(TableRow, { children: [_jsx(TableCell, { className: "max-w-[200px] truncate", title: queue.name, children: queue.name }), _jsx(TableCell, { children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Switch, { checked: Boolean(queue.isActive), onCheckedChange: (checked) => handleToggleActive(queue, checked), disabled: updateQueueMutation.isPending || reorderQueuesMutation.isPending }), _jsx(Badge, { variant: queue.isActive ? 'default' : 'secondary', children: queue.isActive ? 'Ativa' : 'Inativa' })] }) }), _jsx(TableCell, { children: _jsxs("div", { className: "flex items-center gap-1", children: [_jsx("span", { className: "font-mono text-sm", children: queue.orderIndex ?? index }), _jsx(Button, { variant: "ghost", size: "icon", className: "h-8 w-8", onClick: () => handleMove(queue, -1), disabled: index === 0 || reorderQueuesMutation.isPending, "aria-label": "Mover para cima", children: _jsx(ArrowUp, { className: "h-4 w-4" }) }), _jsx(Button, { variant: "ghost", size: "icon", className: "h-8 w-8", onClick: () => handleMove(queue, 1), disabled: index === orderedQueues.length - 1 || reorderQueuesMutation.isPending, "aria-label": "Mover para baixo", children: _jsx(ArrowDown, { className: "h-4 w-4" }) })] }) }), _jsx(TableCell, { className: "max-w-[260px] truncate", title: queue.description ?? '', children: queue.description || _jsx("span", { className: "text-xs text-muted-foreground", children: "\u2014" }) }), _jsx(TableCell, { className: "text-right", children: _jsxs("div", { className: "flex justify-end gap-2", children: [_jsxs(Button, { variant: "outline", size: "sm", onClick: () => setEditingQueue(queue), children: [_jsx(Edit, { className: "mr-2 h-4 w-4" }), " Editar"] }), _jsxs(Button, { variant: "outline", size: "sm", className: "text-destructive", onClick: () => setQueueToDelete(queue), disabled: deleteQueueMutation.isPending, children: [_jsx(Trash2, { className: "mr-2 h-4 w-4" }), " Remover"] })] }) })] }, queue.id))) })] })) })] }), _jsx(QueueFormDialog, { open: isCreateOpen, onOpenChange: (open) => {
                    setIsCreateOpen(open);
                }, defaultValues: createDefaults, onSubmit: (values) => createQueueMutation.mutate(values), submitLabel: createQueueMutation.isPending ? 'Criando...' : 'Criar fila', title: "Nova fila", description: "Defina o nome, status e a posi\u00E7\u00E3o da fila no atendimento.", loading: createQueueMutation.isPending }), _jsx(QueueFormDialog, { open: Boolean(editingQueue), onOpenChange: (open) => {
                    if (!open) {
                        setEditingQueue(null);
                    }
                }, defaultValues: editDefaults, onSubmit: (values) => {
                    if (editingQueue) {
                        updateQueueMutation.mutate({ id: editingQueue.id, values });
                    }
                }, submitLabel: updateQueueMutation.isPending ? 'Salvando...' : 'Salvar alterações', title: "Editar fila", description: "Atualize a configura\u00E7\u00E3o da fila selecionada.", loading: updateQueueMutation.isPending }), _jsx(AlertDialog, { open: Boolean(queueToDelete), onOpenChange: (open) => (!open ? setQueueToDelete(null) : null), children: _jsxs(AlertDialogContent, { children: [_jsxs(AlertDialogHeader, { children: [_jsx(AlertDialogTitle, { children: "Remover fila" }), _jsx(AlertDialogDescription, { children: "Essa a\u00E7\u00E3o n\u00E3o pode ser desfeita. Confirme se nenhum atendimento depende desta fila antes de prosseguir." })] }), _jsxs(AlertDialogFooter, { children: [_jsx(AlertDialogCancel, { disabled: deleteQueueMutation.isPending, children: "Cancelar" }), _jsxs(AlertDialogAction, { className: "bg-destructive text-destructive-foreground hover:bg-destructive/90", disabled: deleteQueueMutation.isPending, onClick: () => {
                                        if (queueToDelete) {
                                            deleteQueueMutation.mutate(queueToDelete.id);
                                        }
                                    }, children: [deleteQueueMutation.isPending ? (_jsx(Loader2, { className: "mr-2 h-4 w-4 animate-spin" })) : (_jsx(Trash2, { className: "mr-2 h-4 w-4" })), "Remover definitivamente"] })] })] }) })] }));
};
export default QueuesTab;
