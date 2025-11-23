import { ConflictError, NotFoundError, WhatsappActionPayloadSchema } from '@ticketz/core';
import type { NormalizedMessagePayload, OutboundMessageResponse } from '@ticketz/contracts';
import { findContactsByIds } from '@ticketz/storage';
import { z } from 'zod';

import { logger } from '../../config/logger';
import { sendToContact } from '../ticket-service';

type WhatsappActionPayload = z.infer<typeof WhatsappActionPayloadSchema>;

type WhatsappBulkResult = { contactId: string; status: string; error?: string };

type WhatsappBulkParams = {
  tenantId: string;
  operatorId: string;
  payload: WhatsappActionPayload;
  concurrency?: number;
};

type NormalizePayloadFn = (payload: { type: string; [key: string]: unknown }) => NormalizedMessagePayload;

let normalizePayloadCached: NormalizePayloadFn | null = null;
const loadNormalizePayload = async (): Promise<NormalizePayloadFn> => {
  if (!normalizePayloadCached) {
    const mod = await import('@ticketz/contracts');
    normalizePayloadCached = mod.normalizePayload as NormalizePayloadFn;
  }
  return normalizePayloadCached;
};

const DEFAULT_CONCURRENCY = (() => {
  const raw = process.env.WHATSAPP_BULK_CONCURRENCY;
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
})();

const resolveMessageText = (payload: WhatsappActionPayload): string | null => {
  const textMessage = typeof payload.message?.text === 'string' ? payload.message.text.trim() : '';
  if (textMessage.length > 0) {
    return textMessage;
  }

  const templateName = typeof payload.template?.name === 'string' ? payload.template.name.trim() : '';
  if (templateName.length > 0) {
    return templateName;
  }

  return null;
};

const buildErrorDetails = (error: unknown): string => {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Unknown error';
};

const runWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> => {
  const results: R[] = new Array(items.length);
  const safeLimit = Math.max(1, Math.min(limit, items.length));
  let cursor = 0;

  const runners = Array.from({ length: safeLimit }, async () => {
    while (cursor < items.length) {
      const currentIndex = cursor++;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(runners);
  return results;
};

export const sendWhatsappBulkAction = async ({
  tenantId,
  operatorId,
  payload,
  concurrency,
}: WhatsappBulkParams): Promise<WhatsappBulkResult[]> => {
  const parsedPayload = WhatsappActionPayloadSchema.parse(payload);

  const contacts = await findContactsByIds(tenantId, parsedPayload.contactIds);

  if (!contacts.length) {
    throw new NotFoundError('Contact', parsedPayload.contactIds.join(','));
  }

  const resolvedText = resolveMessageText(parsedPayload);

  if (!resolvedText) {
    throw new ConflictError('Whatsapp action requires a message payload.');
  }

  const normalizePayload = await loadNormalizePayload();
  const normalizedPayload = normalizePayload({
    type: 'text',
    text: resolvedText,
  });

  const limit = concurrency ?? DEFAULT_CONCURRENCY;
  const failures: Array<{ contactId: string; error: string }> = [];

  logger.info('[WhatsappBulk] Dispatching bulk action', {
    tenantId,
    operatorId,
    contactCount: contacts.length,
    concurrency: limit,
  });

  const results = await runWithConcurrency(contacts, limit, async (contact): Promise<WhatsappBulkResult> => {
    try {
      const response: OutboundMessageResponse = await sendToContact({
        tenantId,
        operatorId,
        contactId: contact.id,
        payload: normalizedPayload,
      });

      logger.info('[WhatsappBulk] Message sent to contact', {
        tenantId,
        operatorId,
        contactId: contact.id,
        status: response.status,
      });

      return { contactId: contact.id, status: response.status };
    } catch (error) {
      const details = buildErrorDetails(error);
      failures.push({ contactId: contact.id, error: details });

      logger.error('[WhatsappBulk] Failed to send whatsapp message', {
        tenantId,
        operatorId,
        contactId: contact.id,
        error: details,
      });

      return { contactId: contact.id, status: 'error', error: details };
    }
  });

  if (failures.length > 0) {
    logger.warn('[WhatsappBulk] Bulk action completed with failures', {
      tenantId,
      operatorId,
      failures,
    });
  }

  return results;
};
