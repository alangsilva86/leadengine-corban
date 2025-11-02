import type { UseMutationResult } from '@tanstack/react-query';

export type UpdateNextStepMetadata = Record<string, unknown>;

export interface UpdateNextStepVariables {
  targetTicketId?: string;
  description?: string;
  metadata?: UpdateNextStepMetadata;
}

export type UpdateNextStepResponse = Record<string, unknown> | null;

export declare const useUpdateNextStep: (params?: {
  ticketId?: string;
}) => UseMutationResult<
  UpdateNextStepResponse,
  unknown,
  UpdateNextStepVariables,
  unknown
>;

export type UpdateNextStepMutation = ReturnType<typeof useUpdateNextStep>;

export default useUpdateNextStep;
