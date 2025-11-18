import type { Message, Ticket, TicketStatus } from '../../types/tickets';
import { emitToAgreement, emitToTenant, emitToTicket, emitToUser } from '../../../lib/socket-registry';
import type { TicketSalesEvent } from '../../data/ticket-sales-event-store';
import { resolveWhatsAppInstanceId } from './whatsapp';

export type MessageRealtimeEnvelope = {
  tenantId: string;
  ticketId: string;
  agreementId: string | null;
  instanceId: string | null;
  messageId: string;
  providerMessageId: string | null;
  ticketStatus: TicketStatus;
  ticketUpdatedAt: string;
  message: Message;
};

export type TicketRealtimeEnvelope = {
  tenantId: string;
  ticketId: string;
  agreementId: string | null;
  instanceId: string | null;
  messageId: string | null;
  providerMessageId: string | null;
  ticketStatus: TicketStatus;
  ticketStage: Ticket['stage'];
  ticketUpdatedAt: string;
  ticket: Ticket;
};

const emitTicketEvent = (
  tenantId: string,
  ticketId: string,
  event: string,
  payload: unknown,
  userId?: string | null,
  agreementId?: string | null
) => {
  emitToTenant(tenantId, event, payload);
  emitToTicket(ticketId, event, payload);
  if (agreementId) {
    emitToAgreement(agreementId, event, payload);
  }
  if (userId) {
    emitToUser(userId, event, payload);
  }
};

const resolveTicketAgreementId = (ticket: Ticket): string | null => {
  const agreementId = (ticket as Ticket & { agreementId?: string | null }).agreementId;
  if (typeof agreementId === 'string' && agreementId.trim().length > 0) {
    return agreementId.trim();
  }

  if (ticket.metadata && typeof ticket.metadata === 'object') {
    const metadata = ticket.metadata as Record<string, unknown>;
    const direct = metadata['agreementId'];
    if (typeof direct === 'string' && direct.trim().length > 0) {
      return direct.trim();
    }

    const snakeCase = metadata['agreement_id'];
    if (typeof snakeCase === 'string' && snakeCase.trim().length > 0) {
      return snakeCase.trim();
    }

    const nested = metadata['agreement'];
    if (nested && typeof nested === 'object') {
      const nestedId = (nested as Record<string, unknown>)['id'];
      if (typeof nestedId === 'string' && nestedId.trim().length > 0) {
        return nestedId.trim();
      }

      const nestedAgreementId = (nested as Record<string, unknown>)['agreementId'];
      if (typeof nestedAgreementId === 'string' && nestedAgreementId.trim().length > 0) {
        return nestedAgreementId.trim();
      }
    }
  }

  return null;
};

const buildRealtimeEnvelopeBase = ({
  tenantId,
  ticket,
  message,
  messageId,
  providerMessageId,
  instanceId,
}: {
  tenantId: string;
  ticket: Ticket;
  message?: Message | null;
  messageId?: string | null;
  providerMessageId?: string | null;
  instanceId?: string | null;
}): Omit<TicketRealtimeEnvelope, 'ticket'> => {
  const agreementId = resolveTicketAgreementId(ticket);
  const resolvedMessageId = message?.id ?? messageId ?? null;
  const resolvedProviderMessageId = providerMessageId ?? null;
  const resolvedInstanceId = instanceId ?? message?.instanceId ?? resolveWhatsAppInstanceId(ticket) ?? null;
  const updatedAtIso =
    (ticket.updatedAt instanceof Date ? ticket.updatedAt : null)?.toISOString() ?? new Date().toISOString();

  return {
    tenantId,
    ticketId: ticket.id,
    agreementId,
    instanceId: resolvedInstanceId,
    messageId: resolvedMessageId,
    providerMessageId: resolvedProviderMessageId,
    ticketStatus: ticket.status,
    ticketStage: ticket.stage,
    ticketUpdatedAt: updatedAtIso,
  };
};

export const buildMessageRealtimeEnvelope = ({
  tenantId,
  ticket,
  message,
  instanceId,
  providerMessageId,
}: {
  tenantId: string;
  ticket: Ticket;
  message: Message;
  instanceId?: string | null;
  providerMessageId?: string | null;
}): MessageRealtimeEnvelope => {
  const base = buildRealtimeEnvelopeBase({
    tenantId,
    ticket,
    message,
    messageId: message.id,
    providerMessageId: providerMessageId ?? null,
    instanceId: instanceId ?? null,
  });

  return {
    tenantId: base.tenantId,
    ticketId: base.ticketId,
    agreementId: base.agreementId,
    instanceId: base.instanceId,
    messageId: message.id,
    providerMessageId: base.providerMessageId,
    ticketStatus: base.ticketStatus,
    ticketUpdatedAt: base.ticketUpdatedAt,
    message,
  };
};

export const buildTicketRealtimeEnvelope = ({
  tenantId,
  ticket,
  message,
  messageId,
  providerMessageId,
  instanceId,
}: {
  tenantId: string;
  ticket: Ticket;
  message?: Message | null;
  messageId?: string | null;
  providerMessageId?: string | null;
  instanceId?: string | null;
}): TicketRealtimeEnvelope => {
  const base = buildRealtimeEnvelopeBase({
    tenantId,
    ticket,
    message: message ?? null,
    messageId: messageId ?? null,
    providerMessageId: providerMessageId ?? null,
    instanceId: instanceId ?? null,
  });

  return {
    ...base,
    ticket,
  };
};

export const emitTicketRealtimeEnvelope = (
  tenantId: string,
  ticket: Ticket,
  envelope: TicketRealtimeEnvelope,
  userId?: string | null
) => {
  const agreementId = resolveTicketAgreementId(ticket);
  emitTicketEvent(tenantId, ticket.id, 'tickets.updated', envelope, userId ?? null, agreementId);
};

export const emitTicketSalesTimelineEvent = (
  tenantId: string,
  ticket: Ticket,
  event: TicketSalesEvent,
  actorId: string | null
) => {
  const agreementId = resolveTicketAgreementId(ticket);
  emitTicketEvent(tenantId, ticket.id, 'tickets.sales.timeline', event, actorId, agreementId);
};

export const broadcastSalesOperationResult = (
  tenantId: string,
  ticket: Ticket,
  event: TicketSalesEvent,
  actorId: string | null
) => {
  const ticketEnvelope = buildTicketRealtimeEnvelope({ tenantId, ticket });
  emitTicketRealtimeEnvelope(tenantId, ticket, ticketEnvelope, actorId);
  emitTicketSalesTimelineEvent(tenantId, ticket, event, actorId);
};

export { emitTicketEvent, resolveTicketAgreementId };
