import { ConflictError, NotFoundError } from '@ticketz/core';

import { logger } from '../../../config/logger';
import { createTicket as createTicketService } from '../../../services/ticket-service';
import { mapErrorForLog } from './logging';
import {
  getDefaultQueueId,
  isForeignKeyError,
  provisionDefaultQueueForTenant,
  queueCacheByTenant,
} from './provisioning';

const isMissingQueueError = (error: unknown): boolean => {
  if (!error) return false;
  if (error instanceof NotFoundError) return true;
  if (isForeignKeyError(error)) return true;
  if (typeof error === 'object' && error !== null) {
    if (error instanceof Error && error.name === 'NotFoundError') return true;
    const cause = (error as { cause?: unknown }).cause;
    if (cause && cause !== error) return isMissingQueueError(cause);
  }
  return false;
};

export const ensureTicketForContact = async (
  tenantId: string,
  contactId: string,
  queueId: string,
  subject: string,
  metadata: Record<string, unknown>
): Promise<string | null> => {
  const createTicketWithQueue = async (targetQueueId: string) =>
    createTicketService({
      tenantId,
      contactId,
      queueId: targetQueueId,
      channel: 'WHATSAPP',
      priority: 'NORMAL',
      subject,
      tags: ['whatsapp', 'inbound'],
      metadata,
    });

  try {
    const ticket = await createTicketWithQueue(queueId);
    return ticket.id;
  } catch (error: unknown) {
    if (error instanceof ConflictError) {
      const details = (error.details ?? {}) as Record<string, unknown>;
      const existingTicketId = typeof details.existingTicketId === 'string' ? details.existingTicketId : undefined;
      if (existingTicketId) return existingTicketId;
    }

    if (isMissingQueueError(error)) {
      queueCacheByTenant.delete(tenantId);
      let refreshedQueueId: string | null = null;

      try {
        refreshedQueueId = await getDefaultQueueId(tenantId, { provisionIfMissing: false });
      } catch (refreshError) {
        logger.warn('Failed to refresh WhatsApp queue after missing queue error', {
          error: mapErrorForLog(refreshError),
          tenantId,
          contactId,
        });
      }

      if (!refreshedQueueId) {
        try {
          refreshedQueueId = await provisionDefaultQueueForTenant(tenantId);
        } catch (provisionError) {
          logger.error('Failed to ensure WhatsApp ticket for contact after queue refresh', {
            error: mapErrorForLog(provisionError),
            tenantId,
            contactId,
          });
          return null;
        }
      }

      if (refreshedQueueId) {
        try {
          const ticket = await createTicketWithQueue(refreshedQueueId);
          return ticket.id;
        } catch (retryError) {
          if (retryError instanceof ConflictError) {
            const details = (retryError.details ?? {}) as Record<string, unknown>;
            const existingTicketId = typeof details.existingTicketId === 'string' ? details.existingTicketId : undefined;
            if (existingTicketId) return existingTicketId;
          }
          logger.error('Failed to ensure WhatsApp ticket for contact after queue refresh', {
            error: mapErrorForLog(retryError),
            tenantId,
            contactId,
          });
          return null;
        }
      }
    }

    logger.error('Failed to ensure WhatsApp ticket for contact', {
      error: mapErrorForLog(error),
      tenantId,
      contactId,
    });
    return null;
  }
};

export const __testing = {
  isMissingQueueError,
  ensureTicketForContact,
};
