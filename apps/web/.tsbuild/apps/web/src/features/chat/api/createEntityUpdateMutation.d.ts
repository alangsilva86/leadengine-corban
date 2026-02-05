import { UseMutationResult } from '@tanstack/react-query';
type Identifier = string | number;
type EntityWithId = {
    id?: Identifier | null;
};
type UpdateVariables<TData, TTargetIdKey extends string> = {
    data: TData;
} & Partial<Record<TTargetIdKey, Identifier>>;
type HookParams<TDefaultIdKey extends string> = Partial<Record<TDefaultIdKey, Identifier>>;
interface CreateEntityUpdateMutationArgs<TEntity extends EntityWithId, TData, TDefaultIdKey extends string, TTargetIdKey extends string> {
    entityName: string;
    baseEndpoint: string;
    mutationKey: readonly [string, string];
    entityCacheKey: string;
    defaultIdKey: TDefaultIdKey;
    targetIdKey: TTargetIdKey;
}
export declare function createEntityUpdateMutation<TEntity extends EntityWithId, TData extends Record<string, unknown>, TDefaultIdKey extends string, TTargetIdKey extends string>({ entityName, baseEndpoint, mutationKey, entityCacheKey, defaultIdKey, targetIdKey, }: CreateEntityUpdateMutationArgs<TEntity, TData, TDefaultIdKey, TTargetIdKey>): (params?: HookParams<TDefaultIdKey>) => UseMutationResult<TEntity | null, unknown, UpdateVariables<TData, TTargetIdKey>>;
export {};
