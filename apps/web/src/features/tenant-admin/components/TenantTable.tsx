import { Fragment } from 'react';
import { Edit3, Power, PowerOff } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import type { TenantEntity } from '../types';
import TenantStatusBadge from './TenantStatusBadge';

const formatDateTime = (value: string) => {
  try {
    const date = new Date(value);
    return Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(date);
  } catch {
    return value;
  }
};

export interface TenantTableProps {
  tenants: TenantEntity[];
  loading?: boolean;
  emptyMessage?: string;
  onEdit: (tenantId: string) => void;
  onToggleActive: (tenant: TenantEntity) => void;
  togglingTenantId?: string | null;
}

const TenantTable = ({
  tenants,
  loading,
  emptyMessage = 'Nenhum tenant encontrado.',
  onEdit,
  onToggleActive,
  togglingTenantId,
}: TenantTableProps) => {
  const isEmpty = !loading && tenants.length === 0;

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Criado em</TableHead>
            <TableHead>Atualizado em</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading
            ? Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={`loading-${index}`}>
                  <TableCell colSpan={6}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            : null}
          {!loading &&
            tenants.map((tenant) => {
              const isToggling = togglingTenantId === tenant.id;
              return (
                <TableRow key={tenant.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{tenant.name}</span>
                      <span className="text-xs text-muted-foreground">ID: {tenant.id}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-sm">{tenant.slug}</span>
                  </TableCell>
                  <TableCell>
                    <TenantStatusBadge isActive={tenant.isActive} />
                  </TableCell>
                  <TableCell>{formatDateTime(tenant.createdAt)}</TableCell>
                  <TableCell>{formatDateTime(tenant.updatedAt)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onEdit(tenant.id)}
                        aria-label={`Editar ${tenant.name}`}
                      >
                        <Edit3 className="mr-1.5 h-4 w-4" />
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant={tenant.isActive ? 'secondary' : 'default'}
                        onClick={() => onToggleActive(tenant)}
                        disabled={isToggling}
                      >
                        {tenant.isActive ? (
                          <Fragment>
                            <PowerOff className="mr-1.5 h-4 w-4" />
                            Desativar
                          </Fragment>
                        ) : (
                          <Fragment>
                            <Power className="mr-1.5 h-4 w-4" />
                            Ativar
                          </Fragment>
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          {isEmpty ? (
            <TableRow>
              <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
        <TableCaption>
          {loading ? 'Atualizando tenants...' : 'Somente operadores autorizados podem alterar tenants.'}
        </TableCaption>
      </Table>
    </div>
  );
};

export default TenantTable;
