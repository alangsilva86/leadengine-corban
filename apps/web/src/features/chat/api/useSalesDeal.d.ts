import type { UseMutationResult } from '@tanstack/react-query';

export type SalesDealInput = {
  ticketId?: string | null;
  calculationSnapshot: Record<string, unknown>;
  leadId?: string | null;
  simulationId?: string | null;
  proposalId?: string | null;
  stage?: string | null;
  metadata?: Record<string, unknown> | null;
  closedAt?: string | null;
};

export type SalesDealResponse = {
  deal?: Record<string, unknown> | null;
  ticket?: Record<string, unknown> | null;
  event?: Record<string, unknown> | null;
} | null;

declare const useSalesDeal: (options?: {
  fallbackTicketId?: string | null;
}) => UseMutationResult<SalesDealResponse, Error, SalesDealInput, unknown>;

export default useSalesDeal;
