import { useMemo, useState } from 'react';
import { Loader2, MailPlus, Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Separator } from '@/components/ui/separator.jsx';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { useAuth } from '@/features/auth/AuthProvider.jsx';
import {
  useCreateUserMutation,
  useDeactivateUserMutation,
  useInviteUserMutation,
  useUpdateUserMutation,
  useUsersQuery,
} from '../hooks/useUsersApi';
import type { CreateUserInput, InviteUserInput, UsersStatusFilter, UserRole } from '../types';
import UsersTable from './UsersTable';
import CreateUserDialog from './CreateUserDialog';
import UserInviteDialog from './UserInviteDialog';

const filterOptions: Array<{ label: string; value: UsersStatusFilter }> = [
  { label: 'Ativos', value: 'active' },
  { label: 'Inativos', value: 'inactive' },
  { label: 'Todos', value: 'all' },
];

const readErrorMessage = (error: unknown, fallback = 'Não foi possível completar a ação.') => {
  if (!error) {
    return fallback;
  }
  if (error instanceof Error) {
    return error.message || fallback;
  }
  if (typeof error === 'object' && 'payload' in error) {
    const payloadError = (error as { payload?: { error?: { message?: string } } }).payload?.error?.message;
    if (payloadError) {
      return payloadError;
    }
  }
  return fallback;
};

const UsersSettingsTab = () => {
  const [statusFilter, setStatusFilter] = useState<UsersStatusFilter>('active');
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const { user: currentUser } = useAuth();

  const usersQuery = useUsersQuery(statusFilter);
  const createMutation = useCreateUserMutation();
  const inviteMutation = useInviteUserMutation();
  const updateMutation = useUpdateUserMutation();
  const deactivateMutation = useDeactivateUserMutation();

  const busyUserIds = useMemo(() => {
    const ids = new Set<string>();
    if (updateMutation.isPending && updateMutation.variables?.userId) {
      ids.add(updateMutation.variables.userId);
    }
    if (deactivateMutation.isPending && deactivateMutation.variables?.userId) {
      ids.add(deactivateMutation.variables.userId);
    }
    return Array.from(ids);
  }, [updateMutation.isPending, updateMutation.variables, deactivateMutation.isPending, deactivateMutation.variables]);

  const users = usersQuery.data ?? [];

  const handleRoleChange = (userId: string, nextRole: UserRole) => {
    const target = users.find((item) => item.id === userId);
    if (!target || target.role === nextRole) {
      return;
    }
    updateMutation.mutate(
      { userId, role: nextRole },
      {
        onSuccess: () => {
          toast.success('Função atualizada.');
        },
        onError: (error) => {
          toast.error(readErrorMessage(error, 'Não foi possível atualizar a função.'));
        },
      }
    );
  };

  const handleToggleStatus = (userId: string, isActive: boolean) => {
    updateMutation.mutate(
      { userId, isActive },
      {
        onSuccess: () => {
          toast.success(`Usuário ${isActive ? 'reativado' : 'desativado'}.`);
        },
        onError: (error) => {
          toast.error(readErrorMessage(error, 'Falha ao alterar status do usuário.'));
        },
      }
    );
  };

  const handleDeactivate = (userId: string) => {
    deactivateMutation.mutate(
      { userId },
      {
        onSuccess: () => {
          toast.success('Usuário desativado.');
        },
        onError: (error) => {
          toast.error(readErrorMessage(error, 'Não foi possível desativar o usuário.'));
        },
      }
    );
  };

  const handleCreateSubmit = (payload: CreateUserInput) => {
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

  const handleInviteSubmit = (payload: InviteUserInput) => {
    inviteMutation.mutate(payload, {
      onSuccess: (invite) => {
        toast.success('Convite enviado por e-mail.');
        if (invite?.token) {
          console.info('Token de convite gerado', invite.token);
        }
        setInviteOpen(false);
      },
      onError: (error) => {
        toast.error(readErrorMessage(error, 'Não foi possível enviar o convite.'));
      },
    });
  };

  const pending = usersQuery.isLoading;
  const isFetching = usersQuery.isFetching && !usersQuery.isLoading;

  const tenantSlug =
    currentUser?.tenant?.slug ??
    (typeof currentUser?.tenantSlug === 'string' ? currentUser?.tenantSlug : '') ??
    '';

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle>Equipe do workspace</CardTitle>
            <CardDescription>Gerencie usuários internos, roles e convites com poucos cliques.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => usersQuery.refetch()} disabled={usersQuery.isFetching}>
              <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
            </Button>
            <Button variant="outline" onClick={() => setInviteOpen(true)}>
              <MailPlus className="mr-2 h-4 w-4" /> Convidar
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Novo usuário
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ToggleGroup
              type="single"
              value={statusFilter}
              onValueChange={(value) => value && setStatusFilter(value as UsersStatusFilter)}
              variant="outline"
            >
              {filterOptions.map((option) => (
                <ToggleGroupItem key={option.value} value={option.value} aria-label={`Filtrar ${option.label}`}>
                  {option.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <Badge variant="secondary">{users.length} usuários</Badge>
          </div>
          <Separator />
          {pending ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <UsersTable
              users={users}
              onRoleChange={handleRoleChange}
              onToggleActive={handleToggleStatus}
              onRemove={handleDeactivate}
              busyUserIds={busyUserIds}
              currentUserId={currentUser?.id}
            />
          )}
          {isFetching && !pending ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Atualizando lista…
            </div>
          ) : null}
        </CardContent>
      </Card>
      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} onSubmit={handleCreateSubmit} submitting={createMutation.isPending} />
      <UserInviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onSubmit={handleInviteSubmit}
        submitting={inviteMutation.isPending}
        defaultSlug={tenantSlug}
      />
    </div>
  );
};

export default UsersSettingsTab;
