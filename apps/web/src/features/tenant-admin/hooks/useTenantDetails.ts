import { useQuery } from '@tanstack/react-query';
import { tenantAdminClient } from '../api/tenantAdminClient';
import { tenantAdminQueryKeys } from './useTenantList';

export const useTenantDetails = (tenantId?: string) => {
  return useQuery({
    queryKey: tenantId ? tenantAdminQueryKeys.detail(tenantId) : ['tenant-admin', 'detail', 'idle'],
    queryFn: () => {
      if (!tenantId) {
        throw new Error('Tenant id is required');
      }
      return tenantAdminClient.getTenant(tenantId);
    },
    enabled: Boolean(tenantId),
  });
};
