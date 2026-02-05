import type { CreateUserInput, TenantUser, UpdateUserInput, UsersStatusFilter } from '../types';
export declare const useUsersQuery: (status?: UsersStatusFilter) => import("@tanstack/react-query").UseQueryResult<TenantUser[], Error>;
export declare const useCreateUserMutation: () => import("@tanstack/react-query").UseMutationResult<TenantUser, Error, CreateUserInput, unknown>;
export declare const useUpdateUserMutation: () => import("@tanstack/react-query").UseMutationResult<TenantUser, Error, UpdateUserInput, unknown>;
export declare const useDeactivateUserMutation: () => import("@tanstack/react-query").UseMutationResult<TenantUser, Error, {
    userId: string;
}, unknown>;
