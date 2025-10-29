import type { UseMutationResult } from '@tanstack/react-query';

export interface UpdateDealFieldsVariables {
  targetLeadId?: string;
  data: Record<string, unknown>;
}

export type UpdateDealFieldsResponse = Record<string, unknown> | null;

export declare const useUpdateDealFields: (params?: {
  leadId?: string;
}) => UseMutationResult<
  UpdateDealFieldsResponse,
  unknown,
  UpdateDealFieldsVariables,
  unknown
>;

export type UpdateDealFieldsMutation = ReturnType<typeof useUpdateDealFields>;

export default useUpdateDealFields;
