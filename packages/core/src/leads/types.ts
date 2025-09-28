import { z } from 'zod';
import {
  BaseEntitySchema,
  EntityIdSchema,
  TenantIdSchema,
  TimestampSchema,
  ChannelTypeSchema,
} from '../common/types';

// ============================================================================
// Lead Status
// ============================================================================

export const LeadStatusSchema = z.enum([
  'NEW',        // Lead novo, não contactado
  'CONTACTED',  // Primeiro contato realizado
  'ENGAGED',    // Lead engajado, respondeu
  'QUALIFIED',  // Lead qualificado, atende critérios
  'PROPOSAL',   // Proposta enviada
  'NEGOTIATION',// Em negociação
  'CONVERTED',  // Convertido em venda
  'LOST',       // Perdido
  'NURTURING',  // Em nutrição (follow-up)
]);

export type LeadStatus = z.infer<typeof LeadStatusSchema>;

// ============================================================================
// Lead Source
// ============================================================================

export const LeadSourceSchema = z.enum([
  'ORGANIC',      // Busca orgânica
  'PAID_ADS',     // Anúncios pagos
  'SOCIAL_MEDIA', // Redes sociais
  'EMAIL',        // Email marketing
  'REFERRAL',     // Indicação
  'WHATSAPP',     // WhatsApp
  'WEBSITE',      // Site/Landing page
  'PHONE',        // Telefone/URA
  'EVENT',        // Evento/Feira
  'PARTNER',      // Parceiro
  'IMPORT',       // Importação
  'OTHER',        // Outros
]);

export type LeadSource = z.infer<typeof LeadSourceSchema>;

// ============================================================================
// Lead Score
// ============================================================================

export const LeadScoreSchema = z.object({
  total: z.number().min(0).max(100),
  demographic: z.number().min(0).max(100).default(0),
  behavioral: z.number().min(0).max(100).default(0),
  engagement: z.number().min(0).max(100).default(0),
  firmographic: z.number().min(0).max(100).default(0),
  lastCalculatedAt: TimestampSchema,
});

export type LeadScore = z.infer<typeof LeadScoreSchema>;

// ============================================================================
// Campaign
// ============================================================================

export const CampaignTypeSchema = z.enum([
  'EMAIL',
  'WHATSAPP',
  'SMS',
  'VOICE',
  'SOCIAL',
  'DISPLAY',
  'SEARCH',
]);

export type CampaignType = z.infer<typeof CampaignTypeSchema>;

export const CampaignStatusSchema = z.enum([
  'DRAFT',
  'SCHEDULED',
  'RUNNING',
  'PAUSED',
  'COMPLETED',
  'CANCELLED',
]);

export type CampaignStatus = z.infer<typeof CampaignStatusSchema>;

export const CampaignSchema = BaseEntitySchema.extend({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  type: CampaignTypeSchema,
  status: CampaignStatusSchema.default('DRAFT'),
  startDate: TimestampSchema.optional(),
  endDate: TimestampSchema.optional(),
  budget: z.number().nonnegative().optional(),
  targetAudience: z.record(z.unknown()).default({}),
  content: z.record(z.unknown()).default({}),
  settings: z.record(z.unknown()).default({}),
  metrics: z.record(z.unknown()).default({}),
});

export type Campaign = z.infer<typeof CampaignSchema>;

// ============================================================================
// Lead
// ============================================================================

export const LeadSchema = BaseEntitySchema.extend({
  contactId: EntityIdSchema,
  campaignId: EntityIdSchema.optional(),
  userId: EntityIdSchema.optional(), // Responsável pelo lead
  status: LeadStatusSchema.default('NEW'),
  source: LeadSourceSchema,
  score: LeadScoreSchema.optional(),
  value: z.number().nonnegative().optional(), // Valor estimado
  probability: z.number().min(0).max(100).optional(), // % de conversão
  expectedCloseDate: TimestampSchema.optional(),
  actualCloseDate: TimestampSchema.optional(),
  lostReason: z.string().max(500).optional(),
  tags: z.array(z.string()).default([]),
  customFields: z.record(z.unknown()).default({}),
  lastContactAt: TimestampSchema.optional(),
  nextFollowUpAt: TimestampSchema.optional(),
  notes: z.string().max(2000).optional(),
});

export type Lead = z.infer<typeof LeadSchema>;

// ============================================================================
// Lead Activity
// ============================================================================

export const LeadActivityTypeSchema = z.enum([
  'CREATED',
  'STATUS_CHANGED',
  'CONTACTED',
  'EMAIL_SENT',
  'EMAIL_OPENED',
  'EMAIL_CLICKED',
  'WHATSAPP_SENT',
  'WHATSAPP_REPLIED',
  'CALL_MADE',
  'CALL_ANSWERED',
  'MEETING_SCHEDULED',
  'MEETING_COMPLETED',
  'PROPOSAL_SENT',
  'PROPOSAL_VIEWED',
  'CONTRACT_SIGNED',
  'NOTE_ADDED',
  'SCORE_UPDATED',
  'ASSIGNED',
  'CONVERTED',
  'LOST',
]);

export type LeadActivityType = z.infer<typeof LeadActivityTypeSchema>;

export const LeadActivitySchema = BaseEntitySchema.extend({
  leadId: EntityIdSchema,
  userId: EntityIdSchema.optional(),
  type: LeadActivityTypeSchema,
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  metadata: z.record(z.unknown()).default({}),
  occurredAt: TimestampSchema,
});

export type LeadActivity = z.infer<typeof LeadActivitySchema>;

// ============================================================================
// Attribution Model
// ============================================================================

export const AttributionModelSchema = z.enum([
  'FIRST_TOUCH',  // Primeiro toque
  'LAST_TOUCH',   // Último toque
  'LINEAR',       // Linear (distribuído igualmente)
  'TIME_DECAY',   // Decaimento temporal
  'POSITION',     // Baseado na posição
  'DATA_DRIVEN',  // Baseado em dados
]);

export type AttributionModel = z.infer<typeof AttributionModelSchema>;

export const TouchpointSchema = z.object({
  id: EntityIdSchema,
  leadId: EntityIdSchema,
  campaignId: EntityIdSchema.optional(),
  channel: ChannelTypeSchema,
  source: LeadSourceSchema,
  medium: z.string().optional(),
  content: z.string().optional(),
  term: z.string().optional(),
  weight: z.number().min(0).max(1).default(1),
  value: z.number().nonnegative().optional(),
  occurredAt: TimestampSchema,
  metadata: z.record(z.unknown()).default({}),
});

export type Touchpoint = z.infer<typeof TouchpointSchema>;

export const AttributionSchema = z.object({
  leadId: EntityIdSchema,
  model: AttributionModelSchema,
  touchpoints: z.array(TouchpointSchema),
  totalValue: z.number().nonnegative(),
  calculatedAt: TimestampSchema,
});

export type Attribution = z.infer<typeof AttributionSchema>;

// ============================================================================
// DTOs (Data Transfer Objects)
// ============================================================================

export const CreateLeadDTOSchema = z.object({
  tenantId: TenantIdSchema,
  contactId: EntityIdSchema,
  campaignId: EntityIdSchema.optional(),
  source: LeadSourceSchema,
  value: z.number().nonnegative().optional(),
  probability: z.number().min(0).max(100).optional(),
  expectedCloseDate: TimestampSchema.optional(),
  tags: z.array(z.string()).default([]),
  customFields: z.record(z.unknown()).default({}),
  notes: z.string().max(2000).optional(),
});

export type CreateLeadDTO = z.infer<typeof CreateLeadDTOSchema>;

export const UpdateLeadDTOSchema = z.object({
  status: LeadStatusSchema.optional(),
  userId: EntityIdSchema.optional(),
  value: z.number().nonnegative().optional(),
  probability: z.number().min(0).max(100).optional(),
  expectedCloseDate: TimestampSchema.optional(),
  nextFollowUpAt: TimestampSchema.optional(),
  lostReason: z.string().max(500).optional(),
  tags: z.array(z.string()).optional(),
  customFields: z.record(z.unknown()).optional(),
  notes: z.string().max(2000).optional(),
});

export type UpdateLeadDTO = z.infer<typeof UpdateLeadDTOSchema>;

export const CreateCampaignDTOSchema = z.object({
  tenantId: TenantIdSchema,
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  type: CampaignTypeSchema,
  startDate: TimestampSchema.optional(),
  endDate: TimestampSchema.optional(),
  budget: z.number().nonnegative().optional(),
  targetAudience: z.record(z.unknown()).default({}),
  content: z.record(z.unknown()).default({}),
  settings: z.record(z.unknown()).default({}),
});

export type CreateCampaignDTO = z.infer<typeof CreateCampaignDTOSchema>;

export const AddLeadActivityDTOSchema = z.object({
  leadId: EntityIdSchema,
  userId: EntityIdSchema.optional(),
  type: LeadActivityTypeSchema,
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  metadata: z.record(z.unknown()).default({}),
  occurredAt: TimestampSchema.optional(),
});

export type AddLeadActivityDTO = z.infer<typeof AddLeadActivityDTOSchema>;

// ============================================================================
// Filters
// ============================================================================

export const LeadFiltersSchema = z.object({
  status: z.array(LeadStatusSchema).optional(),
  source: z.array(LeadSourceSchema).optional(),
  userId: z.array(EntityIdSchema).optional(),
  campaignId: z.array(EntityIdSchema).optional(),
  tags: z.array(z.string()).optional(),
  scoreMin: z.number().min(0).max(100).optional(),
  scoreMax: z.number().min(0).max(100).optional(),
  valueMin: z.number().nonnegative().optional(),
  valueMax: z.number().nonnegative().optional(),
  probabilityMin: z.number().min(0).max(100).optional(),
  probabilityMax: z.number().min(0).max(100).optional(),
  createdFrom: TimestampSchema.optional(),
  createdTo: TimestampSchema.optional(),
  expectedCloseFrom: TimestampSchema.optional(),
  expectedCloseTo: TimestampSchema.optional(),
  search: z.string().optional(),
});

export type LeadFilters = z.infer<typeof LeadFiltersSchema>;

export const CampaignFiltersSchema = z.object({
  type: z.array(CampaignTypeSchema).optional(),
  status: z.array(CampaignStatusSchema).optional(),
  startDateFrom: TimestampSchema.optional(),
  startDateTo: TimestampSchema.optional(),
  endDateFrom: TimestampSchema.optional(),
  endDateTo: TimestampSchema.optional(),
  search: z.string().optional(),
});

export type CampaignFilters = z.infer<typeof CampaignFiltersSchema>;

// ============================================================================
// Events
// ============================================================================

export const LeadCreatedEventSchema = z.object({
  type: z.literal('LEAD_CREATED'),
  leadId: EntityIdSchema,
  contactId: EntityIdSchema,
  source: LeadSourceSchema,
  campaignId: EntityIdSchema.optional(),
});

export const LeadStatusChangedEventSchema = z.object({
  type: z.literal('LEAD_STATUS_CHANGED'),
  leadId: EntityIdSchema,
  status: LeadStatusSchema,
  previousStatus: LeadStatusSchema,
  userId: EntityIdSchema.optional(),
});

export const LeadAssignedEventSchema = z.object({
  type: z.literal('LEAD_ASSIGNED'),
  leadId: EntityIdSchema,
  userId: EntityIdSchema,
  previousUserId: EntityIdSchema.optional(),
});

export const LeadConvertedEventSchema = z.object({
  type: z.literal('LEAD_CONVERTED'),
  leadId: EntityIdSchema,
  value: z.number().nonnegative(),
  userId: EntityIdSchema.optional(),
});

export const LeadLostEventSchema = z.object({
  type: z.literal('LEAD_LOST'),
  leadId: EntityIdSchema,
  reason: z.string(),
  userId: EntityIdSchema.optional(),
});

export const LeadScoreUpdatedEventSchema = z.object({
  type: z.literal('LEAD_SCORE_UPDATED'),
  leadId: EntityIdSchema,
  score: LeadScoreSchema,
  previousScore: LeadScoreSchema.optional(),
});

export const CampaignStartedEventSchema = z.object({
  type: z.literal('CAMPAIGN_STARTED'),
  campaignId: EntityIdSchema,
  campaignType: CampaignTypeSchema,
});

export const CampaignCompletedEventSchema = z.object({
  type: z.literal('CAMPAIGN_COMPLETED'),
  campaignId: EntityIdSchema,
  metrics: z.record(z.unknown()),
});

export type LeadCreatedEvent = z.infer<typeof LeadCreatedEventSchema>;
export type LeadStatusChangedEvent = z.infer<typeof LeadStatusChangedEventSchema>;
export type LeadAssignedEvent = z.infer<typeof LeadAssignedEventSchema>;
export type LeadConvertedEvent = z.infer<typeof LeadConvertedEventSchema>;
export type LeadLostEvent = z.infer<typeof LeadLostEventSchema>;
export type LeadScoreUpdatedEvent = z.infer<typeof LeadScoreUpdatedEventSchema>;
export type CampaignStartedEvent = z.infer<typeof CampaignStartedEventSchema>;
export type CampaignCompletedEvent = z.infer<typeof CampaignCompletedEventSchema>;

export type LeadDomainEvent =
  | LeadCreatedEvent
  | LeadStatusChangedEvent
  | LeadAssignedEvent
  | LeadConvertedEvent
  | LeadLostEvent
  | LeadScoreUpdatedEvent
  | CampaignStartedEvent
  | CampaignCompletedEvent;
