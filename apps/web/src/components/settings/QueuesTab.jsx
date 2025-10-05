import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api';
import {
  ArrowDown,
  ArrowUp,
  Edit,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';

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

const QueueFormDialog = ({
  open,
  onOpenChange,
  defaultValues,
  onSubmit,
  submitLabel,
  title,
  description,
  loading,
}) => {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da fila</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex.: Atendimento inbound" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Explique como a fila será utilizada (opcional)"
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Identificador de cor</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex.: #2563eb ou primary" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="orderIndex"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ordem de exibição</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-md border p-3">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Fila ativa</FormLabel>
                      <DialogDescription className="text-xs">
                        Fila ficará disponível para roteamento de tickets.
                      </DialogDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {submitLabel}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
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

    const targetIndex = Math.min(
      Math.max(currentIndex + direction, 0),
      Math.max(orderedQueues.length - 1, 0)
    );

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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Filas de atendimento</CardTitle>
            <CardDescription>
              Organize a distribuição de leads e tickets definindo quais filas estarão ativas e em qual ordem.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => queuesQuery.refetch()} disabled={queuesLoading}>
              {queuesLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Atualizar
            </Button>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nova fila
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {queuesLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando filas...
            </div>
          ) : orderedQueues.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
              <p className="max-w-md text-sm text-muted-foreground">
                Nenhuma fila cadastrada. Crie ao menos uma fila ativa para destravar o atendimento inbound na Inbox.
              </p>
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Criar primeira fila
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ordem</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orderedQueues.map((queue, index) => (
                  <TableRow key={queue.id}>
                    <TableCell className="max-w-[200px] truncate" title={queue.name}>
                      {queue.name}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={Boolean(queue.isActive)}
                          onCheckedChange={(checked) => handleToggleActive(queue, checked)}
                          disabled={updateQueueMutation.isPending || reorderQueuesMutation.isPending}
                        />
                        <Badge variant={queue.isActive ? 'default' : 'secondary'}>
                          {queue.isActive ? 'Ativa' : 'Inativa'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-sm">{queue.orderIndex ?? index}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleMove(queue, -1)}
                          disabled={index === 0 || reorderQueuesMutation.isPending}
                          aria-label="Mover para cima"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleMove(queue, 1)}
                          disabled={index === orderedQueues.length - 1 || reorderQueuesMutation.isPending}
                          aria-label="Mover para baixo"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[260px] truncate" title={queue.description ?? ''}>
                      {queue.description || <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingQueue(queue)}
                        >
                          <Edit className="mr-2 h-4 w-4" /> Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive"
                          onClick={() => setQueueToDelete(queue)}
                          disabled={deleteQueueMutation.isPending}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Remover
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <QueueFormDialog
        open={isCreateOpen}
        onOpenChange={(open) => {
          setIsCreateOpen(open);
        }}
        defaultValues={createDefaults}
        onSubmit={(values) => createQueueMutation.mutate(values)}
        submitLabel={createQueueMutation.isPending ? 'Criando...' : 'Criar fila'}
        title="Nova fila"
        description="Defina o nome, status e a posição da fila no atendimento."
        loading={createQueueMutation.isPending}
      />

      <QueueFormDialog
        open={Boolean(editingQueue)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingQueue(null);
          }
        }}
        defaultValues={editDefaults}
        onSubmit={(values) => {
          if (editingQueue) {
            updateQueueMutation.mutate({ id: editingQueue.id, values });
          }
        }}
        submitLabel={updateQueueMutation.isPending ? 'Salvando...' : 'Salvar alterações'}
        title="Editar fila"
        description="Atualize a configuração da fila selecionada."
        loading={updateQueueMutation.isPending}
      />

      <AlertDialog open={Boolean(queueToDelete)} onOpenChange={(open) => (!open ? setQueueToDelete(null) : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover fila</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. Confirme se nenhum atendimento depende desta fila antes de prosseguir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteQueueMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteQueueMutation.isPending}
              onClick={() => {
                if (queueToDelete) {
                  deleteQueueMutation.mutate(queueToDelete.id);
                }
              }}
            >
              {deleteQueueMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Remover definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default QueuesTab;
