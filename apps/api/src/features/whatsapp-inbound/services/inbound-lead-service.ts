import { randomUUID } from 'node:crypto';
import { prisma } from '../../../lib/prisma';
import { logger } from '../../../config/logger';
import { addAllocations } from '../../../data/lead-allocation-store';
import { maskDocument, maskPhone } from '../../../lib/pii';

const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;

const dedupeCache = new Map<string, number>();

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
