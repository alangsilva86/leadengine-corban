import type { UseMutationResult } from '@tanstack/react-query';
import type { LeadStage } from '@ticketz/contracts';

export interface TicketStageMutationVariables {
  ticketId: string;
  stage: LeadStage;
}

export declare function useTicketStageMutation(): UseMutationResult<
  Record<string, unknown> | null,
  unknown,
  TicketStageMutationVariables,
  unknown
>;

export default useTicketStageMutation;
