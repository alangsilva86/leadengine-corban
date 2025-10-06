export const STORAGE_VERSION = '1.0.0';

export { CampaignStatus } from './repositories/campaign-repository';
export type { Campaign } from './repositories/campaign-repository';

export {
  allocateBrokerLeads,
  listAllocations,
  updateAllocation,
  resetAllocationStore,
  type LeadAllocationDto,
  type LeadAllocationStatus,
  type AllocationSummary,
  getCampaignMetrics,
  type CampaignMetrics,
} from './repositories/lead-allocation-repository';

export {
  createOrActivateCampaign,
  updateCampaignStatus,
  findCampaignById,
  findActiveCampaign,
  listCampaigns,
  resetCampaignStore,
} from './repositories/campaign-repository';

export {
  resetTicketStore,
  findTicketById,
  findTicketsByContact,
  createTicket,
  updateTicket,
  assignTicket,
  closeTicket,
  listTickets,
  createMessage,
  createOutboundMessage,
  updateMessage,
  listMessages,
  applyBrokerAck,
} from './repositories/ticket-repository';
