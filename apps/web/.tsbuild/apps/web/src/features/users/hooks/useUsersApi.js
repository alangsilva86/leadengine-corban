import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api';
const USERS_QUERY_BASE_KEY = ['users'];
const buildUsersQueryKey = (status) => [...USERS_QUERY_BASE_KEY, { status }];
const invalidateUsersQueries = (queryClient) => {
    queryClient.invalidateQueries({ queryKey: USERS_QUERY_BASE_KEY });
};
export const useUsersQuery = (status = 'active') => useQuery({
    queryKey: buildUsersQueryKey(status),
    queryFn: async () => {
        const params = new URLSearchParams();
        if (status && status !== 'all') {
            params.set('status', status);
        }
        const query = params.toString();
        const response = (await apiGet(`/api/users${query ? `?${query}` : ''}`));
        return response.data.users;
    },
});
export const useCreateUserMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (payload) => {
            const response = (await apiPost('/api/users', payload));
            return response.data;
        },
        onSuccess: () => {
            invalidateUsersQueries(queryClient);
        },
    });
};
export const useUpdateUserMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ userId, ...payload }) => {
            const response = (await apiPatch(`/api/users/${userId}`, payload));
            return response.data;
        },
        onSuccess: () => {
            invalidateUsersQueries(queryClient);
        },
    });
};
export const useDeactivateUserMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ userId }) => {
            const response = (await apiDelete(`/api/users/${userId}`));
            return response.data;
        },
        onSuccess: () => {
            invalidateUsersQueries(queryClient);
        },
    });
};
