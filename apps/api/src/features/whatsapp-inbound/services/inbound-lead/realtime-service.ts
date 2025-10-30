import type { sendMessage as SendMessageFn } from '../../../services/ticket-service';

import { prisma } from '../../../lib/prisma';
import { logger } from '../../../config/logger';
import { emitToAgreement, emitToTenant, emitToTicket } from '../../../lib/socket-registry';
import { mapErrorForLog } from './logging';
import { resolveTicketAgreementId } from './ticket-utils';

type PersistedMessage = Awaited<ReturnType<SendMessageFn>>;

export const emitRealtimeUpdatesForInbound = async ({
  tenantId,
  ticketId,
  instanceId,
  message,
  providerMessageId,
  emitTicketRealtimeEvents = true,
}: {
  tenantId: string;
  ticketId: string;
  instanceId: string | null;
  message: PersistedMessage;
  providerMessageId: string | null;
  emitTicketRealtimeEvents?: boolean;
}) => {
  const messageMetadata = message?.metadata && typeof message.metadata === 'object'
    ? (message.metadata as Record<string, unknown>)
    : {};
  const eventMetadata = messageMetadata.eventMetadata && typeof messageMetadata.eventMetadata === 'object'
    ? (messageMetadata.eventMetadata as Record<string, unknown>)
    : {};
  const requestId =
    typeof eventMetadata.requestId === 'string' && eventMetadata.requestId.trim().length > 0
      ? eventMetadata.requestId
      : null;

  if (!emitTicketRealtimeEvents) {
    logger.info('🎯 LeadEngine • WhatsApp :: 🔕 Eventos realtime já propagados na criação da mensagem', {
      requestId,
      tenantId,
      ticketId,
      messageId: message?.id,
      providerMessageId,
      agreementId: null,
    });
    return;
  }

  try {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });

    if (!ticket) {
      logger.warn('Failed to emit realtime updates – ticket not found', { tenantId, ticketId });
      return;
    }

    const agreementId = resolveTicketAgreementId(ticket) ?? 'unknown';
    const realtimeEnvelope = {
      tenantId,
      ticket: { id: ticketId, agreementId },
      message,
      providerMessageId,
      instanceId,
    };

    emitToTenant(tenantId, 'ticketMessages.new', realtimeEnvelope);
    emitToTicket(ticketId, 'ticketMessages.new', realtimeEnvelope);
    emitToTenant(tenantId, 'leadActivities.new', realtimeEnvelope);
    emitToTicket(ticketId, 'leadActivities.new', realtimeEnvelope);
    if (agreementId) emitToAgreement(agreementId, 'leadActivities.new', realtimeEnvelope);

    logger.info('🎯 LeadEngine • WhatsApp :: 🔔 Eventos realtime propagados', {
      requestId,
      tenantId,
      ticketId,
      messageId: message?.id,
      providerMessageId,
      agreementId,
    });
  } catch (error) {
    logger.error('Failed to emit realtime updates for inbound WhatsApp message', {
      error: mapErrorForLog(error),
      tenantId,
      ticketId,
      messageId: message?.id,
    });
  }
};

export const __testing = {
  emitRealtimeUpdatesForInbound,
};
