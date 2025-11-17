import type {
  SalesDeal,
  SalesProposal,
  SalesSimulation,
  Ticket,
} from '../../types/tickets';
import type { TicketSalesEvent } from '../../data/ticket-sales-event-store';
import {
  createSalesDeal as salesCreateDeal,
  createSalesProposal as salesCreateProposal,
  createSalesSimulation as salesCreateSimulation,
  type CreateSalesDealContext,
  type CreateSalesProposalContext,
  type CreateSalesSimulationContext,
  type SalesOperationResponse,
} from '../sales-service';

type BroadcastSalesEventFn = (
  tenantId: string,
  ticket: Ticket,
  event: TicketSalesEvent,
  actorId: string | null
) => void;

export const createSalesOperations = (broadcast: BroadcastSalesEventFn) => {
  const simulateTicketSales = async (
    input: CreateSalesSimulationContext
  ): Promise<SalesOperationResponse<SalesSimulation>> => {
    const result = await salesCreateSimulation(input);
    const actorId = input.actorId ?? null;

    broadcast(input.tenantId, result.ticket, result.event, actorId);

    return result;
  };

  const createTicketSalesProposal = async (
    input: CreateSalesProposalContext
  ): Promise<SalesOperationResponse<SalesProposal>> => {
    const result = await salesCreateProposal(input);
    const actorId = input.actorId ?? null;

    broadcast(input.tenantId, result.ticket, result.event, actorId);

    return result;
  };

  const createTicketSalesDeal = async (
    input: CreateSalesDealContext
  ): Promise<SalesOperationResponse<SalesDeal>> => {
    const result = await salesCreateDeal(input);
    const actorId = input.actorId ?? null;

    broadcast(input.tenantId, result.ticket, result.event, actorId);

    return result;
  };

  return {
    simulateTicketSales,
    createTicketSalesProposal,
    createTicketSalesDeal,
  };
};
