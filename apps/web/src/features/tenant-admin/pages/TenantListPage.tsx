import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert.jsx';
import TenantAdminLayout from '../components/TenantAdminLayout';
import TenantTable from '../components/TenantTable';
import { useTenantList } from '../hooks/useTenantList';
import { useToggleTenantActive } from '../hooks/useTenantMutations';
import type { ListTenantsParams, TenantEntity } from '../types';
import { toast } from 'sonner';
import { readTenantAdminError } from '../utils';

const DEFAULT_LIMIT = 10;
const STATUS_FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'Ativos' },
  { value: 'inactive', label: 'Inativos' },
];

const TenantListPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(() => searchParams.get('search') ?? '');

  const page = Math.max(Number(searchParams.get('page')) || 1, 1);
  const limit = Math.max(Number(searchParams.get('limit')) || DEFAULT_LIMIT, 1);
  const statusFilter = searchParams.get('status') ?? 'all';
  const appliedSearch = searchParams.get('search') ?? '';

  useEffect(() => {
    setSearchInput(appliedSearch);
  }, [appliedSearch]);

  const queryParams = useMemo(() => {
    const params: ListTenantsParams = { page, limit };
    if (appliedSearch.trim()) {
      params.search = appliedSearch.trim();
    }
    if (statusFilter === 'active') {
      params.isActive = true;
    } else if (statusFilter === 'inactive') {
      params.isActive = false;
    }
    return params;
  }, [appliedSearch, limit, page, statusFilter]);

  const listQuery = useTenantList(queryParams);
  const toggleMutation = useToggleTenantActive();

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const params = new URLSearchParams(searchParams);
    if (searchInput.trim()) {
      params.set('search', searchInput.trim());
    } else {
      params.delete('search');
    }
    params.set('page', '1');
    setSearchParams(params, { replace: true });
  };

  const handleStatusChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value === 'all') {
      params.delete('status');
    } else {
      params.set('status', value);
    }
    params.set('page', '1');
    setSearchParams(params, { replace: true });
  };

  const handlePageChange = (nextPage: number) => {
    if (nextPage <= 0 || nextPage === page) {
      return;
    }
    const params = new URLSearchParams(searchParams);
    params.set('page', String(nextPage));
    setSearchParams(params, { replace: true });
  };

  const handleToggleTenant = (tenant: TenantEntity) => {
    toggleMutation.mutate(
      { id: tenant.id, isActive: !tenant.isActive },
      {
        onSuccess: () => {
          toast.success(`Tenant ${tenant.isActive ? 'desativado' : 'ativado'} com sucesso.`);
        },
        onError: (error) => {
          toast.error(readTenantAdminError(error));
        },
      }
    );
  };

  const handleCreateClick = () => {
    navigate('/admin/tenants/new');
  };

  const startIndex = listQuery.data ? (listQuery.data.page - 1) * listQuery.data.limit + 1 : 0;
  const endIndex = listQuery.data ? startIndex + listQuery.data.items.length - 1 : 0;

  const isLoading = listQuery.isLoading;
  const isFetching = listQuery.isFetching;
  const errorMessage = listQuery.error ? readTenantAdminError(listQuery.error) : null;

  return (
    <TenantAdminLayout
      title="Tenant Admin"
      description="Crie, edite e suspenda tenants. Esta é a base para futuros planos, features e capabilities."
    >
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <form onSubmit={handleSearchSubmit} className="flex flex-1 items-center gap-3">
            <Input
              placeholder="Buscar por nome ou slug"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="max-w-sm"
            />
            <Button type="submit" variant="outline" disabled={isFetching}>
              Filtrar
            </Button>
          </form>
          <div className="flex flex-wrap items-center gap-3">
            <Select value={statusFilter} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" onClick={() => listQuery.refetch()} disabled={isFetching}>
              <RefreshCcw className="mr-2 h-4 w-4" /> Atualizar
            </Button>
            <Button type="button" onClick={handleCreateClick}>
              <Plus className="mr-2 h-4 w-4" /> Novo tenant
            </Button>
          </div>
        </div>
        {errorMessage ? (
          <Alert variant="destructive">
            <AlertTitle>Erro ao carregar tenants</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}
        <TenantTable
          tenants={listQuery.data?.items ?? []}
          loading={isLoading || isFetching}
          onEdit={(tenantId) => navigate(`/admin/tenants/${tenantId}`)}
          onToggleActive={handleToggleTenant}
          togglingTenantId={toggleMutation.isPending ? toggleMutation.variables?.id ?? null : null}
        />
        <div className="flex flex-col gap-3 border-t border-border pt-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p>
            {listQuery.data && listQuery.data.total > 0
              ? `Mostrando ${startIndex} - ${endIndex} de ${listQuery.data.total} tenants`
              : 'Nenhum tenant encontrado.'}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(page - 1)}
              disabled={!listQuery.data?.hasPrev}
            >
              Anterior
            </Button>
            <span className="text-xs text-muted-foreground">
              Página {listQuery.data?.page ?? 1} de {listQuery.data?.totalPages ?? 1}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(page + 1)}
              disabled={!listQuery.data?.hasNext}
            >
              Próxima
            </Button>
          </div>
        </div>
      </div>
    </TenantAdminLayout>
  );
};

export default TenantListPage;
