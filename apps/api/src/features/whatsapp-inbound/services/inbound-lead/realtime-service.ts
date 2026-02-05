import type * as TicketService from '../../../../services/ticket-service';

import { prisma } from '../../../../lib/prisma';
import { logger } from '../../../../config/logger';
import { emitToCampaign, emitToTenant, emitToTicket } from '../../../../lib/socket-registry';
import { mapErrorForLog } from '../logging';
import { resolveTicketAgreementId, resolveTicketCampaignId } from '../ticket-utils';

type PersistedMessage = Awaited<ReturnType<typeof TicketService.sendMessage>>;

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
    const campaignId = resolveTicketCampaignId(ticket);
    const realtimeEnvelope = {
      tenantId,
      ticket: { id: ticketId, agreementId, campaignId },
      message,
      providerMessageId,
      instanceId,
    };

    emitToTenant(tenantId, 'ticketMessages.new', realtimeEnvelope);
    emitToTicket(ticketId, 'ticketMessages.new', realtimeEnvelope);
    emitToTenant(tenantId, 'leadActivities.new', realtimeEnvelope);
    emitToTicket(ticketId, 'leadActivities.new', realtimeEnvelope);
    if (campaignId) emitToCampaign(campaignId, 'leadActivities.new', realtimeEnvelope);

    logger.info('🎯 LeadEngine • WhatsApp :: 🔔 Eventos realtime propagados', {
      requestId,
      tenantId,
      ticketId,
      messageId: message?.id,
      providerMessageId,
      agreementId,
      campaignId,
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
