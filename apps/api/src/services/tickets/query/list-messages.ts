import { NotFoundError } from '@ticketz/core';
import type { Message, PaginatedResult, Pagination } from '../../types/tickets';
import { findTicketById as storageFindTicketById, listMessages as storageListMessages } from '@ticketz/storage';
import { normalizeMessageMetadata, resolveProviderMessageId } from '../shared/whatsapp';

export const listMessages = async (
  tenantId: string,
  ticketId: string,
  pagination: Pagination
): Promise<PaginatedResult<Message>> => {
  const ticket = await storageFindTicketById(tenantId, ticketId);
  if (!ticket) {
    throw new NotFoundError('Ticket', ticketId);
  }

  const result = await storageListMessages(tenantId, { ticketId }, pagination);

  const items = result.items.map((message) => {
    const existingProviderId =
      'providerMessageId' in message &&
      typeof (message as { providerMessageId?: unknown }).providerMessageId === 'string' &&
      ((message as { providerMessageId: string }).providerMessageId.trim().length > 0)
        ? (message as { providerMessageId: string }).providerMessageId.trim()
        : null;

    const providerMessageId =
      existingProviderId ??
      resolveProviderMessageId(message.metadata) ??
      (typeof message.externalId === 'string' && message.externalId.trim().length > 0
        ? message.externalId.trim()
        : null);

    return {
      ...message,
      providerMessageId: providerMessageId ?? null,
      metadata: normalizeMessageMetadata(message.metadata, providerMessageId ?? null),
    };
  });

  return {
    ...result,
    items,
  };
};
