import { createSalesOperations } from '../sales-operations';
import { broadcastSalesOperationResult } from '../shared/realtime';

const salesOperations = createSalesOperations(broadcastSalesOperationResult);

export const simulateTicketSales = salesOperations.simulateTicketSales;
export const createTicketSalesProposal = salesOperations.createTicketSalesProposal;
export const createTicketSalesDeal = salesOperations.createTicketSalesDeal;
