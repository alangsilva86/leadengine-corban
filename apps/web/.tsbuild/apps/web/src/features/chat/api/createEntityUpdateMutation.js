import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPatch } from '@/lib/api.js';
export function createEntityUpdateMutation({ entityName, baseEndpoint, mutationKey, entityCacheKey, defaultIdKey, targetIdKey, }) {
    return function useEntityUpdateMutation(params = {}) {
        const queryClient = useQueryClient();
        const defaultEntityId = params?.[defaultIdKey] ?? null;
        return useMutation({
            mutationKey: [...mutationKey, defaultEntityId ?? null],
            mutationFn: async (variables) => {
                const targetEntityId = variables?.[targetIdKey] ?? defaultEntityId;
                if (targetEntityId == null) {
                    throw new Error(`${defaultIdKey} is required to update ${entityName} information`);
                }
                const { data } = variables ?? {};
                if (!data || typeof data !== 'object') {
                    throw new Error(`data payload is required to update ${entityName} information`);
                }
                const response = await apiPatch(`${baseEndpoint}/${encodeURIComponent(String(targetEntityId))}`, data);
                return response?.data ?? null;
            },
            onSuccess: (entity) => {
                if (!entity?.id) {
                    return;
                }
                queryClient.invalidateQueries({ queryKey: ['chat', 'tickets'] });
                queryClient.invalidateQueries({ queryKey: [entityCacheKey, entity.id] });
            },
        });
    };
}
