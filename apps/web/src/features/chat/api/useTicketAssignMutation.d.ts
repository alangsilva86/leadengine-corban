import type { UseMutationResult } from '@tanstack/react-query';

export interface TicketAssignMutationVariables {
  ticketId?: string | null;
  userId: string;
}

export type TicketAssignMutationResult = any;

declare function useTicketAssignMutation(args?: {
  fallbackTicketId?: string | null;
}): UseMutationResult<
  TicketAssignMutationResult,
  unknown,
  TicketAssignMutationVariables,
  unknown
>;

export default useTicketAssignMutation;
