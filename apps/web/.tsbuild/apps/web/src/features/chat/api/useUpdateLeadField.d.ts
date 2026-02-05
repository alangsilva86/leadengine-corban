type Lead = {
    id?: string | number;
};
type LeadPayload = Record<string, unknown>;
type LeadHookParams = {
    leadId?: string | number;
};
type LeadMutationVariables = {
    targetLeadId?: string | number;
    data: LeadPayload;
};
export declare const useUpdateLeadField: (params?: Partial<Record<"leadId", string | number>>) => import("@tanstack/react-query").UseMutationResult<Lead | null, unknown, {
    data: LeadPayload;
} & Partial<Record<"targetLeadId", string | number>>>;
export type UpdateLeadFieldMutation = ReturnType<typeof useUpdateLeadField>;
export type UpdateLeadFieldVariables = LeadMutationVariables;
export type UpdateLeadFieldParams = LeadHookParams;
export default useUpdateLeadField;
