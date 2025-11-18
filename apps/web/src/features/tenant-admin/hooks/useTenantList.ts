import { useQuery } from '@tanstack/react-query';
import { tenantAdminClient } from '../api/tenantAdminClient';
import type { ListTenantsParams, PaginatedTenants } from '../types';

export const tenantAdminQueryKeys = {
  all: ['tenant-admin'] as const,
  list: (params: ListTenantsParams) => ['tenant-admin', 'list', params] as const,
  detail: (id: string) => ['tenant-admin', 'detail', id] as const,
};

export const useTenantList = (params: ListTenantsParams) => {
  return useQuery<PaginatedTenants>({
    queryKey: tenantAdminQueryKeys.list(params),
    queryFn: () => tenantAdminClient.listTenants(params),
    keepPreviousData: true,
  });
};
