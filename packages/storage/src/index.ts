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
  type ActiveCampaignFilters,
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
  findPollVoteMessageCandidate,
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
  listContacts,
  getContactById,
  createContact,
  updateContact,
  deleteContacts,
  listContactTags,
  logContactInteraction,
  listContactInteractions,
  createContactTask,
  listContactTasks,
  updateContactTask,
  mergeContacts,
  applyBulkContactsAction,
  findContactsByIds,
} from './repositories/contact-repository';

export {
  enqueueInboundMediaJob,
  findPendingInboundMediaJobs,
  markInboundMediaJobProcessing,
  completeInboundMediaJob,
  rescheduleInboundMediaJob,
  failInboundMediaJob,
  type InboundMediaJob,
  type InboundMediaJobStatus,
  type EnqueueInboundMediaJobInput,
} from './repositories/inbound-media-job-repository';

export {
  getAiConfig,
  upsertAiConfig,
  recordAiSuggestion,
  recordAiRun,
  upsertAiMemory,
  type UpsertAiConfigInput,
  type AiAssistantMode,
} from './repositories/ai-repository';

export {
  getIntegrationState,
  upsertIntegrationState,
  deleteIntegrationState,
} from './repositories/integration-state-repository';
