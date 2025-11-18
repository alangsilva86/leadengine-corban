import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tenantAdminClient } from '../api/tenantAdminClient';
import type { TenantEntity, TenantPayload } from '../types';
import { tenantAdminQueryKeys } from './useTenantList';

export const useCreateTenant = () => {
  const queryClient = useQueryClient();
  return useMutation<TenantEntity, unknown, TenantPayload>({
    mutationFn: tenantAdminClient.createTenant,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: tenantAdminQueryKeys.all });
    },
  });
};

export const useUpdateTenant = () => {
  const queryClient = useQueryClient();
  return useMutation<TenantEntity, unknown, { id: string; payload: Partial<TenantPayload> }>({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<TenantPayload> }) =>
      tenantAdminClient.updateTenant(id, payload),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: tenantAdminQueryKeys.detail(variables.id) });
      void queryClient.invalidateQueries({ queryKey: tenantAdminQueryKeys.all });
    },
  });
};

export const useToggleTenantActive = () => {
  const queryClient = useQueryClient();
  return useMutation<TenantEntity, unknown, { id: string; isActive: boolean }>({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      tenantAdminClient.toggleTenantActive(id, isActive),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: tenantAdminQueryKeys.detail(variables.id) });
      void queryClient.invalidateQueries({ queryKey: tenantAdminQueryKeys.all });
    },
  });
};
