import type { UseMutationResult } from '@tanstack/react-query';

export interface UpdateContactFieldVariables {
  targetContactId?: string;
  data: Record<string, unknown>;
}

export type UpdateContactFieldResponse = Record<string, unknown> | null;

export declare const useUpdateContactField: (params?: {
  contactId?: string;
}) => UseMutationResult<
  UpdateContactFieldResponse,
  unknown,
  UpdateContactFieldVariables,
  unknown
>;

export type UpdateContactFieldMutation = ReturnType<typeof useUpdateContactField>;

export default useUpdateContactField;
