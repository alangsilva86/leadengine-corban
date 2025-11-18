import * as queries from './tickets/query';
import * as lifecycle from './tickets/mutations';
import * as messaging from './tickets/messaging';

export * from './tickets/query';
export * from './tickets/mutations';
export * from './tickets/messaging';
export { getSalesSimulationFilters } from './sales-service';

export const ticketService = {
  queries,
  lifecycle,
  messaging,
};
