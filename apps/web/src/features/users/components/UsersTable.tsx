import { useMemo, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button.jsx';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog.jsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Switch } from '@/components/ui/switch.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import type { TenantUser, UserRole } from '../types';
import UserRoleBadge from './UserRoleBadge';
import UserStatusBadge from './UserStatusBadge';

const formatDateTime = (value: string | null): string => {
  if (!value) {
    return 'Nunca acessou';
  }
  try {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
  } catch {
    return value;
  }
};

const roleOptions: Array<{ label: string; value: UserRole }> = [
  { value: 'ADMIN', label: 'Administrador' },
  { value: 'SUPERVISOR', label: 'Supervisor' },
  { value: 'AGENT', label: 'Agente' },
];

type UsersTableProps = {
  users: TenantUser[];
  onRoleChange: (userId: string, role: UserRole) => void;
  onToggleActive: (userId: string, nextValue: boolean) => void;
  onRemove: (userId: string) => void;
  busyUserIds?: string[];
  currentUserId?: string | null;
};

const UsersTable = ({
  users,
  onRoleChange,
  onToggleActive,
  onRemove,
  busyUserIds = [],
  currentUserId,
}: UsersTableProps) => {
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);

  const busySet = useMemo(() => new Set(busyUserIds), [busyUserIds]);

  const handleConfirmRemoval = () => {
    if (!pendingRemoval) {
      return;
    }
    onRemove(pendingRemoval);
    setPendingRemoval(null);
  };

  if (!users.length) {
    return (
      <div className="rounded-md border border-dashed border-border/80 p-8 text-center text-sm text-muted-foreground">
        Nenhum usuário encontrado para o filtro selecionado.
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border/60">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[220px]">Operador</TableHead>
              <TableHead className="min-w-[180px]">Função</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Último acesso</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const busy = busySet.has(user.id);
              const disableRemoval = !user.isActive || user.id === currentUserId;
              return (
                <TableRow key={user.id} data-testid="users-table-row">
                  <TableCell>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 font-medium text-foreground">
                        {user.name}
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : null}
                      </div>
                      <span className="text-sm text-muted-foreground">{user.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Select value={user.role} onValueChange={(value) => onRoleChange(user.id, value as UserRole)} disabled={busy}>
                        <SelectTrigger aria-label={`Alterar função de ${user.name}`} className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {roleOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <UserRoleBadge role={user.role} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={user.isActive}
                        onCheckedChange={(value) => onToggleActive(user.id, value)}
                        disabled={busy || user.id === currentUserId}
                        aria-label={`Alternar status de ${user.name}`}
                      />
                      <UserStatusBadge isActive={user.isActive} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{formatDateTime(user.lastLoginAt)}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setPendingRemoval(user.id)}
                      disabled={disableRemoval || busy}
                      aria-label={`Desativar ${user.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <AlertDialog open={Boolean(pendingRemoval)} onOpenChange={(open) => (!open ? setPendingRemoval(null) : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deseja desativar este usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              O operador perderá o acesso imediatamente. Você pode reativá-lo a qualquer momento alterando o status para ativo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRemoval}>Desativar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default UsersTable;
