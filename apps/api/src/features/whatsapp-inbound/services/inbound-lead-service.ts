import { randomUUID } from 'node:crypto';
import { ConflictError } from '@ticketz/core';
import { Prisma } from '@prisma/client';

import { prisma } from '../../../lib/prisma';
import { logger } from '../../../config/logger';
import { addAllocations } from '../../../data/lead-allocation-store';
import { maskDocument, maskPhone } from '../../../lib/pii';
import { createTicket as createTicketService, sendMessage as sendMessageService } from '../../../services/ticket-service';
import { emitToTenant } from '../../../lib/socket-registry';

const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;

const dedupeCache = new Map<string, number>();
const queueCacheByTenant = new Map<string, string>();

interface InboundContactDetails {
  phone?: string | null;
  name?: string | null;
  document?: string | null;
  registrations?: string[] | null;
}

interface InboundMessageDetails {
  id?: string | null;
  type?: string | null;
  text?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface InboundWhatsAppEvent {
  id: string;
  instanceId: string;
  timestamp: string | null;
  contact: InboundContactDetails;
  message: InboundMessageDetails;
  metadata?: Record<string, unknown> | null;
}

const sanitizePhone = (value?: string | null): string | undefined => {
  if (!value) {
    return undefined;
  }
  const digits = value.replace(/\D/g, '');
  if (digits.length < 10) {
    return undefined;
  }
  return `+${digits.replace(/^\+/, '')}`;
};

const sanitizeDocument = (value?: string | null, fallback?: string): string => {
  const candidate = (value ?? '').replace(/\D/g, '');
  if (candidate.length >= 4) {
    return candidate;
  }
  const fallbackDigits = (fallback ?? '').replace(/\D/g, '');
  if (fallbackDigits.length >= 4) {
    return fallbackDigits;
  }
  return fallback ?? `wa-${randomUUID()}`;
};

const uniqueStringList = (values?: string[] | null): string[] => {
  if (!Array.isArray(values)) {
    return [];
  }

  const normalized: string[] = [];
  const seen = new Set<string>();

  values.forEach((entry) => {
    if (typeof entry !== 'string') {
      return;
    }
    const trimmed = entry.trim();
    if (!trimmed || seen.has(trimmed)) {
      return;
    }
    seen.add(trimmed);
    normalized.push(trimmed);
  });

  return normalized;
};

const shouldSkipByDedupe = (key: string, now: number): boolean => {
  dedupeCache.set(key, now);
  return false;
};

const getDefaultQueueId = async (tenantId: string): Promise<string | null> => {
  if (queueCacheByTenant.has(tenantId)) {
    return queueCacheByTenant.get(tenantId) as string;
  }

  const queue = await prisma.queue.findFirst({
    where: { tenantId },
    orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
  });

  if (!queue) {
    return null;
  }

  queueCacheByTenant.set(tenantId, queue.id);
  return queue.id;
};

const ensureContact = async (
  tenantId: string,
  {
    phone,
    name,
    document,
    registrations,
    timestamp,
  }: {
    phone?: string;
    name?: string | null;
    document?: string;
    registrations?: string[];
    timestamp?: string | null;
  }
) => {
  const interactionDate = timestamp ? new Date(timestamp) : new Date();

  let contact = null;

  if (phone) {
    contact = await prisma.contact.findUnique({
      where: {
        tenantId_phone: {
          tenantId,
          phone,
        },
      },
    });
  }

  if (!contact && document) {
    contact = await prisma.contact.findFirst({
      where: {
        tenantId,
        document,
      },
    });
  }

  const tags = Array.from(
    new Set([...(contact?.tags ?? []), 'whatsapp', 'inbound'])
  );

  const customFieldsSource =
    typeof contact?.customFields === 'object' && contact?.customFields !== null
      ? (contact.customFields as Record<string, unknown>)
      : {};

  const customFieldsRecord: Record<string, unknown> = {
    ...customFieldsSource,
    source: 'whatsapp',
    lastInboundChannel: 'whatsapp',
  };

  if (registrations && registrations.length > 0) {
    customFieldsRecord.registrations = registrations;
  } else if (!('registrations' in customFieldsRecord)) {
    customFieldsRecord.registrations = [];
  }

  if (!('consent' in customFieldsRecord)) {
    customFieldsRecord.consent = {
      granted: true,
      base: 'legitimate_interest',
      grantedAt: interactionDate.toISOString(),
    };
  }

  const contactData = {
    name: name && name.trim().length > 0 ? name.trim() : contact?.name ?? 'Contato WhatsApp',
    phone: phone ?? contact?.phone ?? null,
    document: document ?? contact?.document ?? null,
    tags,
    customFields: customFieldsRecord as Prisma.InputJsonValue,
    lastInteractionAt: interactionDate,
  };

  if (contact) {
    contact = await prisma.contact.update({
      where: { id: contact.id },
      data: contactData,
    });
  } else {
    contact = await prisma.contact.create({
      data: {
        tenantId,
        ...contactData,
      },
    });
  }

  return contact;
};

const ensureTicketForContact = async (
  tenantId: string,
  contactId: string,
  queueId: string,
  subject: string,
  metadata: Record<string, unknown>
): Promise<string | null> => {
  try {
    const ticket = await createTicketService({
      tenantId,
      contactId,
      queueId,
      channel: 'WHATSAPP',
      priority: 'NORMAL',
      subject,
      tags: ['whatsapp', 'inbound'],
      metadata,
    });
    return ticket.id;
  } catch (error: unknown) {
    if (error instanceof ConflictError) {
      const conflict = error as ConflictError;
      const details = (conflict.details ?? {}) as Record<string, unknown>;
      const existingTicketId =
        typeof details.existingTicketId === 'string'
          ? details.existingTicketId
          : undefined;
      if (existingTicketId) {
        return existingTicketId;
      }
    }

    logger.error('Failed to ensure WhatsApp ticket for contact', {
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
      tenantId,
      contactId,
    });
    return null;
  }
};

type NormalizedMessageType = 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'DOCUMENT' | 'LOCATION' | 'CONTACT' | 'TEMPLATE';

const resolveMessageContent = (message: InboundMessageDetails): {
  content: string;
  type: NormalizedMessageType;
  mediaUrl?: string;
} => {
  const rawType = typeof message.type === 'string' ? message.type.trim().toUpperCase() : 'TEXT';
  const allowedTypes = new Set([
    'TEXT',
    'IMAGE',
    'AUDIO',
    'VIDEO',
    'DOCUMENT',
    'LOCATION',
    'CONTACT',
    'TEMPLATE',
  ]);
  const type: NormalizedMessageType = allowedTypes.has(rawType) ? (rawType as NormalizedMessageType) : 'TEXT';

  const extractText = (value: unknown, depth = 0): string | null => {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        const extracted = extractText(entry, depth + 1);
        if (extracted) {
          return extracted;
        }
      }
      return null;
    }

    if (typeof value === 'object' && value !== null) {
      const record = value as Record<string, unknown>;
      const candidateKeys = [
        'text',
        'body',
        'caption',
        'message',
        'conversation',
        'content',
        'value',
        'description',
        'title',
      ];

      for (const key of candidateKeys) {
        if (key in record) {
          const extracted = extractText(record[key], depth + 1);
          if (extracted) {
            return extracted;
          }
        }
      }

      const nestedCandidates = ['data', 'payload', 'context', 'message', 'preview'];
      for (const key of nestedCandidates) {
        if (key in record) {
          const extracted = extractText(record[key], depth + 1);
          if (extracted) {
            return extracted;
          }
        }
      }
    }

    return null;
  };

  const extractMediaUrl = (value: unknown, depth = 0): string | null => {
    if (!value) {
      return null;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        const extracted = extractMediaUrl(entry, depth + 1);
        if (extracted) {
          return extracted;
        }
      }
      return null;
    }

    if (typeof value === 'object') {
      const record = value as Record<string, unknown>;
      const candidateKeys = [
        'mediaUrl',
        'url',
        'link',
        'href',
        'downloadUrl',
      ];

      for (const key of candidateKeys) {
        if (typeof record[key] === 'string') {
          const extracted = extractMediaUrl(record[key], depth + 1);
          if (extracted) {
            return extracted;
          }
        }
      }

      const nestedCandidates = ['image', 'video', 'audio', 'document', 'sticker', 'media'];
      for (const key of nestedCandidates) {
        if (key in record) {
          const extracted = extractMediaUrl(record[key], depth + 1);
          if (extracted) {
            return extracted;
          }
        }
      }
    }

    return null;
  };

  const content =
    extractText(message.text) ||
    extractText(message) ||
    '[Mensagem recebida via WhatsApp]';

  const metadataRecord = (message.metadata && typeof message.metadata === 'object'
    ? (message.metadata as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  const mediaCandidate =
    extractMediaUrl(metadataRecord) ||
    extractMediaUrl((message as Record<string, unknown>).mediaUrl) ||
    extractMediaUrl(message);

  const mediaUrl = typeof mediaCandidate === 'string' ? mediaCandidate : undefined;

  return {
    content,
    type,
    mediaUrl,
  };
};

export const ingestInboundWhatsAppMessage = async (event: InboundWhatsAppEvent) => {
  const { instanceId, contact, message, timestamp } = event;
  const normalizedPhone = sanitizePhone(contact.phone);
  const document = sanitizeDocument(contact.document, normalizedPhone);
  const now = Date.now();

  logger.info('Processing inbound WhatsApp message', {
    instanceId,
    messageId: message.id ?? null,
    timestamp,
    phone: maskPhone(normalizedPhone ?? null),
    document: maskDocument(document),
  });

  const instance = await prisma.whatsAppInstance.findUnique({ where: { id: instanceId } });

  if (!instance) {
    logger.warn('Inbound message ignored: instance not found', {
      instanceId,
      messageId: message.id ?? null,
    });
    return;
  }

  const tenantId = instance.tenantId;

  const campaigns = await prisma.campaign.findMany({
    where: {
      tenantId,
      whatsappInstanceId: instanceId,
      status: 'active',
    },
  });

  if (!campaigns.length) {
    logger.warn('Inbound message ignored: no active campaigns for instance', {
      tenantId,
      instanceId,
      messageId: message.id ?? null,
    });
    return;
  }

  const leadName = contact.name?.trim() || 'Contato WhatsApp';
  const registrations = uniqueStringList(contact.registrations || null);
  const leadIdBase = message.id || `${instanceId}:${normalizedPhone ?? document}:${timestamp ?? now}`;

  const queueId = await getDefaultQueueId(tenantId);
  if (!queueId) {
    logger.warn('Inbound message ignorado ❤️‍🩹 Nenhuma fila padrão definida para o tenant. Cadastre uma fila em Configurações → Filas para destravar o atendimento.', {
      tenantId,
      instanceId,
    });
    emitToTenant(tenantId, 'whatsapp.queue.missing', {
      tenantId,
      instanceId,
      message: 'Nenhuma fila padrão configurada para receber mensagens inbound.',
    });
    return;
  }

  const contactRecord = await ensureContact(tenantId, {
    phone: normalizedPhone,
    name: leadName,
    document,
    registrations,
    timestamp,
  });

  const ticketMetadata: Record<string, unknown> = {
    source: 'WHATSAPP',
    instanceId,
    campaignIds: campaigns.map((campaign) => campaign.id),
    pipelineStep: 'follow-up',
  };

  const ticketSubject = contactRecord.name || contactRecord.phone || 'Contato WhatsApp';
  const ticketId = await ensureTicketForContact(
    tenantId,
    contactRecord.id,
    queueId,
    ticketSubject,
    ticketMetadata
  );

  if (!ticketId) {
    logger.error('Inbound message ignored: failed to ensure ticket', {
      tenantId,
      instanceId,
      messageId: message.id ?? null,
    });
    return;
  }

  const normalizedMessage = resolveMessageContent(message);

  try {
    await sendMessageService(tenantId, undefined, {
      ticketId,
      content: normalizedMessage.content,
      type: normalizedMessage.type,
      mediaUrl: normalizedMessage.mediaUrl,
      metadata: {
        brokerMessageId: message.id ?? null,
        instanceId,
        campaignIds: campaigns.map((campaign) => campaign.id),
        contact: {
          phone: contactRecord.phone,
          document: contactRecord.document,
          name: contactRecord.name,
        },
        raw: message,
        eventMetadata: event.metadata ?? {},
      },
    });
  } catch (error) {
    logger.error('Failed to persist inbound WhatsApp message in ticket timeline', {
      error,
      tenantId,
      ticketId,
      messageId: message.id ?? null,
    });
  }

  for (const campaign of campaigns) {
    const agreementId = campaign.agreementId || 'unknown';
    const dedupeKey = `${tenantId}:${campaign.id}:${document || normalizedPhone || leadIdBase}`;

    if (shouldSkipByDedupe(dedupeKey, now)) {
      logger.info('Skipping inbound message due to 24h dedupe window', {
        tenantId,
        campaignId: campaign.id,
        instanceId,
        messageId: message.id ?? null,
        phone: maskPhone(normalizedPhone ?? null),
      });
      continue;
    }

    const brokerLead = {
      id: `${leadIdBase}:${campaign.id}`,
      fullName: leadName,
      document,
      registrations,
      agreementId,
      phone: normalizedPhone,
      margin: undefined,
      netMargin: undefined,
      score: undefined,
      tags: ['inbound-whatsapp'],
      raw: {
        from: contact,
        message,
        metadata: event.metadata ?? {},
        receivedAt: timestamp ?? new Date(now).toISOString(),
      },
    };

    try {
      const { newlyAllocated } = await addAllocations(tenantId, campaign.id, [brokerLead]);
      if (newlyAllocated.length > 0) {
        logger.info('Inbound WhatsApp lead allocated', {
          tenantId,
          campaignId: campaign.id,
          instanceId,
          allocationId: newlyAllocated[0].allocationId,
          phone: maskPhone(normalizedPhone ?? null),
          leadId: newlyAllocated[0].leadId,
        });
      }
    } catch (error) {
      logger.error('Failed to allocate inbound WhatsApp lead', {
        error,
        tenantId,
        campaignId: campaign.id,
        instanceId,
        phone: maskPhone(normalizedPhone ?? null),
      });
    }
  }
};
