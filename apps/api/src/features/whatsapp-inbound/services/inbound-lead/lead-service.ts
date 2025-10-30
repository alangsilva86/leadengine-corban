import type { sendMessage as SendMessageFn } from '../../../../services/ticket-service';

import { Prisma } from '@prisma/client';

import { prisma } from '../../../../lib/prisma';
import { logger } from '../../../../config/logger';
import { leadLastContactGauge } from '../../../../lib/metrics';
import { emitToTenant, emitToTicket } from '../../../../lib/socket-registry';
import { mapErrorForLog } from '../logging';

type PersistedMessage = Awaited<ReturnType<SendMessageFn>>;

export const upsertLeadFromInbound = async ({
  tenantId,
  contactId,
  ticketId,
  instanceId,
  providerMessageId,
  message,
}: {
  tenantId: string;
  contactId: string;
  ticketId: string;
  instanceId: string;
  providerMessageId: string | null;
  message: PersistedMessage;
}) => {
  const lastContactAt = message.createdAt instanceof Date ? message.createdAt : new Date();

  const messageMetadata =
    message.metadata && typeof message.metadata === 'object'
      ? (message.metadata as Record<string, unknown>)
      : {};
  const eventMetadata =
    messageMetadata.eventMetadata && typeof messageMetadata.eventMetadata === 'object'
      ? (messageMetadata.eventMetadata as Record<string, unknown>)
      : {};
  const messageRequestId =
    typeof eventMetadata.requestId === 'string' && eventMetadata.requestId.trim().length > 0
      ? eventMetadata.requestId
      : null;

  const preview =
    typeof message.content === 'string' && message.content.trim().length > 0
      ? message.content.trim().slice(0, 140)
      : null;

  const lead = await prisma.lead.upsert({
    where: {
      tenantId_contactId: { tenantId, contactId },
    },
    update: {
      lastContactAt,
    },
    create: {
      tenantId,
      contactId,
      status: 'NEW',
      source: 'WHATSAPP',
      lastContactAt,
    },
  });

  leadLastContactGauge.set({ tenantId, leadId: lead.id }, lastContactAt.getTime());

  const metadata: Record<string, unknown> = {
    ticketId,
    instanceId,
    providerMessageId,
    messageId: message.id,
    contactId,
    direction: message.direction,
  };
  if (preview) metadata.preview = preview;
  if (messageRequestId) metadata.requestId = messageRequestId;

  const existingLeadActivity = await prisma.leadActivity.findFirst({
    where: {
      tenantId,
      leadId: lead.id,
      type: 'WHATSAPP_REPLIED',
      metadata: { path: ['messageId'], equals: message.id },
    },
  });

  if (existingLeadActivity) {
    logger.info('🎯 LeadEngine • WhatsApp :: ♻️ Lead activity reaproveitada', {
      tenantId,
      leadId: lead.id,
      ticketId,
      messageId: message.id,
    });
    return { lead, leadActivity: existingLeadActivity };
  }

  const leadActivity = await prisma.leadActivity.create({
    data: {
      tenantId,
      leadId: lead.id,
      type: 'WHATSAPP_REPLIED',
      title: 'Mensagem recebida pelo WhatsApp',
      metadata: metadata as Prisma.InputJsonValue,
      occurredAt: lastContactAt,
    },
  });

  const realtimeEnvelope = { tenantId, ticketId, instanceId, providerMessageId, message, lead, leadActivity };

  try {
    emitToTenant(tenantId, 'leads.updated', realtimeEnvelope);
    emitToTicket(ticketId, 'leads.updated', realtimeEnvelope);
  } catch (error) {
    logger.error('Failed to emit lead realtime updates for inbound WhatsApp message', {
      error: mapErrorForLog(error),
      tenantId,
      ticketId,
      leadId: lead.id,
      messageId: message.id,
    });
  }

  try {
    emitToTenant(tenantId, 'leadActivities.new', realtimeEnvelope);
    emitToTicket(ticketId, 'leadActivities.new', realtimeEnvelope);
  } catch (error) {
    logger.error('Failed to emit lead activity realtime updates for inbound WhatsApp message', {
      error: mapErrorForLog(error),
      tenantId,
      ticketId,
      leadId: lead.id,
      messageId: message.id,
    });
  }

  return { lead, leadActivity };
};

export const __testing = {
  upsertLeadFromInbound,
};
