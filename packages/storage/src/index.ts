export const STORAGE_VERSION = '1.0.0';

export { getPrismaClient, setPrismaClient } from './prisma-client';

export { CampaignStatus } from './repositories/campaign-repository';
export type { Campaign } from './repositories/campaign-repository';

export {
  allocateBrokerLeads,
  listAllocations,
  updateAllocation,
  type LeadAllocationDto,
  type LeadAllocationStatus,
  type AllocationSummary,
  getCampaignMetrics,
  type CampaignMetrics,
} from './repositories/lead-allocation-repository';

export { resetAllocationStore } from './repositories/lead-allocation-repository';

export {
  createOrActivateCampaign,
  updateCampaignStatus,
  findCampaignById,
  findActiveCampaign,
  listCampaigns,
} from './repositories/campaign-repository';

export { resetCampaignStore } from './repositories/campaign-repository';

export {
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
  findMessageByExternalId,
  findOrCreateOpenTicketByChat,
  upsertMessageByExternalId,
  mapPassthroughMessage,
  listMessages,
  applyBrokerAck,
} from './repositories/ticket-repository';

export type {
  PassthroughMessage,
  PassthroughMessageMedia,
} from './repositories/ticket-repository';

export { resetTicketStore } from './repositories/ticket-repository';

export {
  createPrismaWhatsAppSessionStore,
  createRedisWhatsAppSessionStore,
  type RedisSessionStoreOptions,
} from './repositories/whatsapp-session-store';
