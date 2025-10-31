import { useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query';

import { apiPatch } from '@/lib/api.js';

type Identifier = string | number;

type EntityWithId = {
  id?: Identifier | null;
};

type UpdateVariables<TData, TTargetIdKey extends string> = {
  data: TData;
} & Partial<Record<TTargetIdKey, Identifier>>;

type HookParams<TDefaultIdKey extends string> = Partial<Record<TDefaultIdKey, Identifier>>;

interface CreateEntityUpdateMutationArgs<
  TEntity extends EntityWithId,
  TData,
  TDefaultIdKey extends string,
  TTargetIdKey extends string,
> {
  entityName: string;
  baseEndpoint: string;
  mutationKey: readonly [string, string];
  entityCacheKey: string;
  defaultIdKey: TDefaultIdKey;
  targetIdKey: TTargetIdKey;
}

export function createEntityUpdateMutation<
  TEntity extends EntityWithId,
  TData extends Record<string, unknown>,
  TDefaultIdKey extends string,
  TTargetIdKey extends string,
>({
  entityName,
  baseEndpoint,
  mutationKey,
  entityCacheKey,
  defaultIdKey,
  targetIdKey,
}: CreateEntityUpdateMutationArgs<TEntity, TData, TDefaultIdKey, TTargetIdKey>) {
  return function useEntityUpdateMutation(
    params: HookParams<TDefaultIdKey> = {} as HookParams<TDefaultIdKey>,
  ): UseMutationResult<TEntity | null, unknown, UpdateVariables<TData, TTargetIdKey>> {
    const queryClient = useQueryClient();
    const defaultEntityId = params?.[defaultIdKey] ?? null;

    return useMutation<TEntity | null, unknown, UpdateVariables<TData, TTargetIdKey>>({
      mutationKey: [...mutationKey, defaultEntityId ?? null],
      mutationFn: async (variables) => {
        const targetEntityId = variables?.[targetIdKey] ?? defaultEntityId;

        if (targetEntityId == null) {
          throw new Error(
            `${defaultIdKey} is required to update ${entityName} information`,
          );
        }

        const { data } = variables ?? {};

        if (!data || typeof data !== 'object') {
          throw new Error(`data payload is required to update ${entityName} information`);
        }

        const response = await apiPatch(
          `${baseEndpoint}/${encodeURIComponent(String(targetEntityId))}`,
          data,
        );

        return (response?.data as TEntity | null | undefined) ?? null;
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
