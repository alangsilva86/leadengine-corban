export function buildContactsQueryKey(filters: any): (string | {
    filters: any;
})[];
export function useContactsQuery({ filters, pageSize, enabled }?: {
    filters?: {} | undefined;
    pageSize?: number | undefined;
    enabled?: boolean | undefined;
}): import("@tanstack/react-query").UseInfiniteQueryResult<import("@tanstack/react-query").InfiniteData<any, unknown>, Error>;
export function useCreateContactMutation(): import("@tanstack/react-query").UseMutationResult<any, Error, void, unknown>;
export function useContactDetailsQuery(contactId: any, { enabled }?: {
    enabled?: boolean | undefined;
}): import("@tanstack/react-query").UseQueryResult<any, Error>;
export function useContactTimelineQuery(contactId: any, { enabled }?: {
    enabled?: boolean | undefined;
}): import("@tanstack/react-query").UseQueryResult<any, Error>;
export function useContactTasksQuery(contactId: any, { enabled }?: {
    enabled?: boolean | undefined;
}): import("@tanstack/react-query").UseQueryResult<any, Error>;
export function useUpdateContactMutation(contactId: any): import("@tanstack/react-query").UseMutationResult<any, Error, void, unknown>;
export function useContactBulkMutation(): import("@tanstack/react-query").UseMutationResult<any, Error, void, unknown>;
export function useContactInteractionMutation(contactId: any): import("@tanstack/react-query").UseMutationResult<any, Error, void, unknown>;
export function useContactTaskMutation(contactId: any): {
    createTask: import("@tanstack/react-query").UseMutationResult<any, Error, void, unknown>;
    completeTask: import("@tanstack/react-query").UseMutationResult<any, Error, void, unknown>;
};
export function useTriggerWhatsAppMutation(contactId: any): import("@tanstack/react-query").UseMutationResult<any, Error, void, unknown>;
export function useContactDeduplicateMutation(contactId: any): import("@tanstack/react-query").UseMutationResult<any, Error, void, unknown>;
