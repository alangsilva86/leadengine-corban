import { randomUUID } from 'node:crypto';
import { SalesStage } from '@ticketz/core';

export type TicketSalesEventType = 'simulation.created' | 'proposal.created' | 'deal.created';

export type TicketSalesEvent = {
  id: string;
  tenantId: string;
  ticketId: string;
  type: TicketSalesEventType;
  stage: SalesStage;
  payload: Record<string, unknown>;
  actorId: string | null;
  createdAt: Date;
  metadata?: Record<string, unknown>;
};

type TicketSalesEventBucket = Map<string, TicketSalesEvent[]>; // ticketId -> events

const eventsByTenant = new Map<string, TicketSalesEventBucket>();

const getTenantBucket = (tenantId: string): TicketSalesEventBucket => {
  let bucket = eventsByTenant.get(tenantId);
  if (!bucket) {
    bucket = new Map();
    eventsByTenant.set(tenantId, bucket);
  }

  return bucket;
};

const cloneEvent = (event: TicketSalesEvent): TicketSalesEvent => ({
  ...event,
  payload: { ...event.payload },
  ...(event.metadata ? { metadata: { ...event.metadata } } : {}),
});

export const appendTicketSalesEvent = async ({
  tenantId,
  ticketId,
  type,
  stage,
  payload = {},
  metadata,
  actorId,
  createdAt = new Date(),
}: {
  tenantId: string;
  ticketId: string;
  type: TicketSalesEventType;
  stage: SalesStage;
  payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  actorId?: string | null;
  createdAt?: Date;
}): Promise<TicketSalesEvent> => {
  const tenantBucket = getTenantBucket(tenantId);
  const current = tenantBucket.get(ticketId) ?? [];

  const event: TicketSalesEvent = {
    id: randomUUID(),
    tenantId,
    ticketId,
    type,
    stage,
    payload: { ...payload },
    actorId: actorId ?? null,
    createdAt,
    ...(metadata ? { metadata: { ...metadata } } : {}),
  };

  const updatedList = [...current, event].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  tenantBucket.set(ticketId, updatedList);

  return cloneEvent(event);
};

export const listTicketSalesEvents = async (
  tenantId: string,
  ticketId: string
): Promise<TicketSalesEvent[]> => {
  const tenantBucket = getTenantBucket(tenantId);
  const events = tenantBucket.get(ticketId) ?? [];
  return events.map(cloneEvent);
};

export const listTicketSalesEventsByTickets = async (
  tenantId: string,
  ticketIds: string[]
): Promise<Map<string, TicketSalesEvent[]>> => {
  const tenantBucket = getTenantBucket(tenantId);
  const result = new Map<string, TicketSalesEvent[]>();

  for (const ticketId of ticketIds) {
    const events = tenantBucket.get(ticketId) ?? [];
    result.set(ticketId, events.map(cloneEvent));
  }

  return result;
};

export const resetTicketSalesEventStore = (): void => {
  eventsByTenant.clear();
};
