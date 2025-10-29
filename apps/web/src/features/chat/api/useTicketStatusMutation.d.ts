import type { UseMutationResult } from '@tanstack/react-query';

export interface TicketStatusMutationVariables {
  ticketId?: string | null;
  status: string;
  reason?: string | null;
}

export type TicketStatusMutationResult = any;

declare function useTicketStatusMutation(args?: {
  fallbackTicketId?: string | null;
}): UseMutationResult<
  TicketStatusMutationResult,
  unknown,
  TicketStatusMutationVariables,
  unknown
>;

export default useTicketStatusMutation;
