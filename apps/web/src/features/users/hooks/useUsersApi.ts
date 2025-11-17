import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api';
import type {
  CreateUserInput,
  InviteUserInput,
  TenantUser,
  UpdateUserInput,
  UserInvite,
  UsersStatusFilter,
} from '../types';

const USERS_QUERY_BASE_KEY = ['users'];

const buildUsersQueryKey = (status: UsersStatusFilter) => [...USERS_QUERY_BASE_KEY, { status }];

type UsersListResponse = { success: true; data: { users: TenantUser[] } };
type UserMutationResponse = { success: true; data: TenantUser };
type InviteResponse = { success: true; data: UserInvite };

const invalidateUsersQueries = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: USERS_QUERY_BASE_KEY });
};

export const useUsersQuery = (status: UsersStatusFilter = 'active') =>
  useQuery<TenantUser[]>({
    queryKey: buildUsersQueryKey(status),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status && status !== 'all') {
        params.set('status', status);
      }
      const query = params.toString();
      const response = (await apiGet(`/api/users${query ? `?${query}` : ''}`)) as UsersListResponse;
      return response.data.users;
    },
  });

export const useCreateUserMutation = () => {
  const queryClient = useQueryClient();
  return useMutation<TenantUser, Error, CreateUserInput>({
    mutationFn: async (payload) => {
      const response = (await apiPost('/api/users', payload)) as UserMutationResponse;
      return response.data;
    },
    onSuccess: () => {
      invalidateUsersQueries(queryClient);
    },
  });
};

export const useInviteUserMutation = () =>
  useMutation<UserInvite, Error, InviteUserInput>({
    mutationFn: async ({ tenantSlugHint, ...payload }) => {
      const body: Record<string, unknown> = {
        email: payload.email,
        role: payload.role,
      };
      if (payload.expiresInDays) {
        body.expiresInDays = payload.expiresInDays;
      }
      if (tenantSlugHint) {
        body.tenantSlugHint = tenantSlugHint;
      }
      const response = (await apiPost('/api/users/invites', body)) as InviteResponse;
      return response.data;
    },
  });

export const useUpdateUserMutation = () => {
  const queryClient = useQueryClient();
  return useMutation<TenantUser, Error, UpdateUserInput>({
    mutationFn: async ({ userId, ...payload }) => {
      const response = (await apiPatch(`/api/users/${userId}`, payload)) as UserMutationResponse;
      return response.data;
    },
    onSuccess: () => {
      invalidateUsersQueries(queryClient);
    },
  });
};

export const useDeactivateUserMutation = () => {
  const queryClient = useQueryClient();
  return useMutation<TenantUser, Error, { userId: string }>({
    mutationFn: async ({ userId }) => {
      const response = (await apiDelete(`/api/users/${userId}`)) as UserMutationResponse;
      return response.data;
    },
    onSuccess: () => {
      invalidateUsersQueries(queryClient);
    },
  });
};
