import type { UseMutationResult } from '@tanstack/react-query';

export type SalesProposalInput = {
  ticketId?: string | null;
  calculationSnapshot: Record<string, unknown>;
  leadId?: string | null;
  simulationId?: string | null;
  stage?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type SalesProposalResponse = {
  proposal?: Record<string, unknown> | null;
  ticket?: Record<string, unknown> | null;
  event?: Record<string, unknown> | null;
} | null;

declare const useSalesProposal: (options?: {
  fallbackTicketId?: string | null;
}) => UseMutationResult<SalesProposalResponse, Error, SalesProposalInput, unknown>;

export default useSalesProposal;
