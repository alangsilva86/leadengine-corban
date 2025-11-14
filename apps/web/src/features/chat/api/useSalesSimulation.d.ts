import type { UseMutationResult } from '@tanstack/react-query';

export type SalesSimulationInput = {
  ticketId?: string | null;
  calculationSnapshot: Record<string, unknown>;
  leadId?: string | null;
  stage?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type SalesSimulationResponse = {
  simulation?: Record<string, unknown> | null;
  ticket?: Record<string, unknown> | null;
  event?: Record<string, unknown> | null;
} | null;

declare const useSalesSimulation: (options?: {
  fallbackTicketId?: string | null;
}) => UseMutationResult<SalesSimulationResponse, Error, SalesSimulationInput, unknown>;

export default useSalesSimulation;
