import {
  DEFAULT_SALES_STAGE,
  SALES_STAGE_TRANSITIONS,
  SalesStage,
  canTransition,
} from '@ticketz/core';
import {
  createSalesDeal as storageCreateSalesDeal,
  createSalesProposal as storageCreateSalesProposal,
  createSalesSimulation as storageCreateSalesSimulation,
  findTicketById as storageFindTicketById,
  updateTicket as storageUpdateTicket,
  type CreateSalesDealDTO,
  type CreateSalesProposalDTO,
  type CreateSalesSimulationDTO,
  type SalesDeal,
  type SalesProposal,
  type SalesSimulation,
  type Ticket,
} from '@ticketz/storage';
import { NotFoundError, ValidationError } from '@ticketz/core';

import {
  appendTicketSalesEvent,
  type TicketSalesEvent,
} from '../data/ticket-sales-event-store';
import type { TicketStage } from '../types/tickets';
import { logger } from '../config/logger';
import {
  salesDealCounter,
  salesOperationsCounter,
  salesProposalCounter,
  salesSimulationCounter,
} from '../lib/metrics';
import {
  extractSalesContext,
  recordSalesFunnelOperation,
  type SalesContextMetadata,
  type SalesOperationKind,
} from '../data/sales-funnel-aggregator';

type TicketWithSalesStage = Ticket & { stage: TicketStage };

const isSalesStage = (value: string | null | undefined): value is SalesStage =>
  typeof value === 'string' && Object.values(SalesStage).includes(value as SalesStage);

const resolveSalesStage = (stage: string | null | undefined): SalesStage => {
  if (isSalesStage(stage)) {
    return stage;
  }

  return SalesStage.DESCONHECIDO;
};

const ensureTicket = async (tenantId: string, ticketId: string): Promise<TicketWithSalesStage> => {
  const ticket = await storageFindTicketById(tenantId, ticketId);
  if (!ticket) {
    throw new NotFoundError('Ticket', ticketId);
  }

  return ticket as TicketWithSalesStage;
};

const applyStageTransition = async (
  tenantId: string,
  ticket: TicketWithSalesStage,
  stage: SalesStage | null | undefined
): Promise<TicketWithSalesStage> => {
  if (!stage) {
    return ticket;
  }

  const currentStage = resolveSalesStage(ticket.stage);
  if (currentStage === stage) {
    return ticket;
  }

  if (!canTransition(currentStage, stage)) {
    throw new ValidationError('Transição de estágio de vendas inválida.', {
      details: { from: currentStage, to: stage },
    });
  }

  const updated = await storageUpdateTicket(tenantId, ticket.id, {
    stage: stage as unknown as TicketStage,
  });

  if (!updated) {
    throw new NotFoundError('Ticket', ticket.id);
  }

  return updated as TicketWithSalesStage;
};

type OperationContext = {
  tenantId: string;
  ticketId: string;
  stage?: SalesStage | null;
  actorId?: string | null;
  leadId?: string | null;
  metadata?: Record<string, unknown> | null;
};

type SimulationContext = OperationContext & {
  calculationSnapshot: Record<string, unknown>;
};

type ProposalContext = OperationContext & {
  calculationSnapshot: Record<string, unknown>;
  simulationId?: string | null;
};

type DealContext = OperationContext & {
  calculationSnapshot: Record<string, unknown>;
  simulationId?: string | null;
  proposalId?: string | null;
  closedAt?: Date | string | null;
};

type SalesOperationResult<T> = {
  entity: T;
  ticket: TicketWithSalesStage;
  event: TicketSalesEvent;
};

const sanitizeMetricLabel = (value: string | null | undefined, fallback = 'unknown'): string => {
  if (typeof value !== 'string') {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
};

const buildSalesMetricLabels = (
  tenantId: string,
  stage: SalesStage,
  context: SalesContextMetadata
): Record<string, string> => ({
  tenantId,
  stage,
  agreementId: sanitizeMetricLabel(context.agreementId),
  agreementName: sanitizeMetricLabel(context.agreementName ?? context.agreementId),
  campaignId: sanitizeMetricLabel(context.campaignId),
  productType: sanitizeMetricLabel(context.productType),
  strategy: sanitizeMetricLabel(context.strategy),
});

const logSalesOperation = (
  operation: SalesOperationKind,
  params: {
    tenantId: string;
    ticket: TicketWithSalesStage;
    stage: SalesStage;
    actorId: string | null;
    operationContext: OperationContext;
    salesContext: SalesContextMetadata;
    event: TicketSalesEvent;
    entity: SalesSimulation | SalesProposal | SalesDeal;
  }
): void => {
  const basePayload = {
    tenantId: params.tenantId,
    ticketId: params.ticket.id,
    stage: params.stage,
    operation,
    actorId: params.actorId ?? null,
    eventId: params.event.id,
    eventType: params.event.type,
    agreementId: params.salesContext.agreementId ?? null,
    agreementName: params.salesContext.agreementName ?? null,
    campaignId: params.salesContext.campaignId ?? null,
    campaignName: params.salesContext.campaignName ?? null,
    productType: params.salesContext.productType ?? null,
    strategy: params.salesContext.strategy ?? null,
    instanceId: params.salesContext.instanceId ?? null,
  } satisfies Record<string, unknown>;

  if (operation === 'simulation') {
    const entity = params.entity as SalesSimulation;
    logger.info('sales.operation.simulation', {
      ...basePayload,
      simulationId: entity.id,
      leadId: entity.leadId ?? null,
      actorContext: params.operationContext.actorId ?? null,
    });
    return;
  }

  if (operation === 'proposal') {
    const entity = params.entity as SalesProposal;
    logger.info('sales.operation.proposal', {
      ...basePayload,
      proposalId: entity.id,
      simulationId: entity.simulationId ?? null,
      leadId: entity.leadId ?? null,
      actorContext: params.operationContext.actorId ?? null,
    });
    return;
  }

  const entity = params.entity as SalesDeal;
  let closedAt: string | null = null;
  if (entity.closedAt instanceof Date) {
    closedAt = entity.closedAt.toISOString();
  } else if (typeof entity.closedAt === 'string') {
    const trimmed = entity.closedAt.trim();
    closedAt = trimmed.length > 0 ? trimmed : null;
  }

  logger.info('sales.operation.deal', {
    ...basePayload,
    dealId: entity.id,
    simulationId: entity.simulationId ?? null,
    proposalId: entity.proposalId ?? null,
    leadId: entity.leadId ?? null,
    closedAt,
    actorContext: params.operationContext.actorId ?? null,
  });
};

const applySalesTelemetry = <T extends SalesSimulation | SalesProposal | SalesDeal>({
  tenantId,
  operation,
  ticket,
  actorId,
  operationContext,
  entity,
  event,
}: {
  tenantId: string;
  operation: SalesOperationKind;
  ticket: TicketWithSalesStage;
  actorId: string | null;
  operationContext: OperationContext;
  entity: T;
  event: TicketSalesEvent;
}): void => {
  const stage = resolveSalesStage(ticket.stage);
  const salesContext = extractSalesContext(ticket);
  const metricLabels = buildSalesMetricLabels(tenantId, stage, salesContext);

  salesOperationsCounter.inc({ tenantId, operation, stage });
  if (operation === 'simulation') {
    salesSimulationCounter.inc(metricLabels);
  } else if (operation === 'proposal') {
    salesProposalCounter.inc(metricLabels);
  } else if (operation === 'deal') {
    salesDealCounter.inc(metricLabels);
  }

  recordSalesFunnelOperation({ tenantId, ticket, stage, operation, context: salesContext });
  logSalesOperation(operation, {
    tenantId,
    ticket,
    stage,
    actorId,
    operationContext,
    salesContext,
    entity,
    event,
  });
};

const buildSimulationDTO = (context: SimulationContext): CreateSalesSimulationDTO => ({
  tenantId: context.tenantId,
  ticketId: context.ticketId,
  leadId: context.leadId ?? undefined,
  calculationSnapshot: context.calculationSnapshot,
  metadata: context.metadata ?? undefined,
});

const buildProposalDTO = (context: ProposalContext): CreateSalesProposalDTO => ({
  tenantId: context.tenantId,
  ticketId: context.ticketId,
  leadId: context.leadId ?? undefined,
  simulationId: context.simulationId ?? undefined,
  calculationSnapshot: context.calculationSnapshot,
  metadata: context.metadata ?? undefined,
});

const buildDealDTO = (context: DealContext): CreateSalesDealDTO => ({
  tenantId: context.tenantId,
  ticketId: context.ticketId,
  leadId: context.leadId ?? undefined,
  simulationId: context.simulationId ?? undefined,
  proposalId: context.proposalId ?? undefined,
  calculationSnapshot: context.calculationSnapshot,
  metadata: context.metadata ?? undefined,
  closedAt: context.closedAt instanceof Date ? context.closedAt : context.closedAt ? new Date(context.closedAt) : undefined,
});

const recordTimelineEvent = async (
  context: OperationContext,
  ticket: TicketWithSalesStage,
  type: TicketSalesEvent['type'],
  payload: Record<string, unknown>
): Promise<TicketSalesEvent> =>
  appendTicketSalesEvent({
    tenantId: context.tenantId,
    ticketId: context.ticketId,
    type,
    stage: resolveSalesStage(ticket.stage),
    payload,
    actorId: context.actorId ?? null,
    metadata: context.metadata ?? undefined,
  });

export const getSalesSimulationFilters = () => {
  const transitions: Array<{ from: SalesStage; to: SalesStage[] }> = [];

  for (const [from, targets] of SALES_STAGE_TRANSITIONS.entries()) {
    transitions.push({ from, to: Array.from(targets) });
  }

  return {
    stages: Object.values(SalesStage),
    defaultStage: DEFAULT_SALES_STAGE,
    transitions,
  };
};

export const createSalesSimulation = async (
  context: SimulationContext
): Promise<SalesOperationResult<SalesSimulation>> => {
  const ticket = await ensureTicket(context.tenantId, context.ticketId);
  const updatedTicket = await applyStageTransition(context.tenantId, ticket, context.stage ?? null);
  const simulation = await storageCreateSalesSimulation(buildSimulationDTO(context));

  const event = await recordTimelineEvent(context, updatedTicket, 'simulation.created', {
    simulationId: simulation.id,
    leadId: simulation.leadId ?? null,
    calculationSnapshot: { ...simulation.calculationSnapshot },
  });

  applySalesTelemetry({
    tenantId: context.tenantId,
    operation: 'simulation',
    ticket: updatedTicket,
    actorId: context.actorId ?? null,
    operationContext: context,
    entity: simulation,
    event,
  });

  return {
    entity: simulation,
    ticket: updatedTicket,
    event,
  };
};

export const createSalesProposal = async (
  context: ProposalContext
): Promise<SalesOperationResult<SalesProposal>> => {
  const ticket = await ensureTicket(context.tenantId, context.ticketId);
  const updatedTicket = await applyStageTransition(context.tenantId, ticket, context.stage ?? null);
  const proposal = await storageCreateSalesProposal(buildProposalDTO(context));

  const event = await recordTimelineEvent(context, updatedTicket, 'proposal.created', {
    proposalId: proposal.id,
    simulationId: proposal.simulationId ?? null,
    leadId: proposal.leadId ?? null,
    calculationSnapshot: { ...proposal.calculationSnapshot },
  });

  applySalesTelemetry({
    tenantId: context.tenantId,
    operation: 'proposal',
    ticket: updatedTicket,
    actorId: context.actorId ?? null,
    operationContext: context,
    entity: proposal,
    event,
  });

  return {
    entity: proposal,
    ticket: updatedTicket,
    event,
  };
};

export const createSalesDeal = async (
  context: DealContext
): Promise<SalesOperationResult<SalesDeal>> => {
  const ticket = await ensureTicket(context.tenantId, context.ticketId);
  const updatedTicket = await applyStageTransition(context.tenantId, ticket, context.stage ?? null);
  const deal = await storageCreateSalesDeal(buildDealDTO(context));

  const event = await recordTimelineEvent(context, updatedTicket, 'deal.created', {
    dealId: deal.id,
    proposalId: deal.proposalId ?? null,
    simulationId: deal.simulationId ?? null,
    leadId: deal.leadId ?? null,
    closedAt: deal.closedAt ? deal.closedAt.toISOString() : null,
    calculationSnapshot: { ...deal.calculationSnapshot },
  });

  applySalesTelemetry({
    tenantId: context.tenantId,
    operation: 'deal',
    ticket: updatedTicket,
    actorId: context.actorId ?? null,
    operationContext: context,
    entity: deal,
    event,
  });

  return {
    entity: deal,
    ticket: updatedTicket,
    event,
  };
};

export type {
  DealContext as CreateSalesDealContext,
  ProposalContext as CreateSalesProposalContext,
  SimulationContext as CreateSalesSimulationContext,
  SalesOperationResult as SalesOperationResponse,
};
