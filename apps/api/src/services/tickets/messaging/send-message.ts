import { ConflictError, NotFoundError, ServiceUnavailableError } from '@ticketz/core';
import type { Message, SendMessageDTO, Ticket } from '../../types/tickets';
import {
  createMessage as storageCreateMessage,
  findMessageByExternalId as storageFindMessageByExternalId,
  findTicketById as storageFindTicketById,
  updateMessage as storageUpdateMessage,
} from '@ticketz/storage';
import { emitTicketEvent, emitTicketRealtimeEnvelope, buildMessageRealtimeEnvelope, buildTicketRealtimeEnvelope } from '../shared/realtime';
import { resolveTicketAgreementId } from '../shared/realtime';
import { resolveProviderMessageId, resolveWhatsAppInstanceId, normalizeBrokerStatus } from '../shared/whatsapp';
import { mergeEnrichmentMetadata } from '../enrichment';
import { logger } from '../../../config/logger';
import { prisma } from '../../../lib/prisma';
import { whatsappSocketReconnectsCounter } from '../../../lib/metrics';
import { emitToTenant } from '../../../lib/socket-registry';
import { WhatsAppBrokerError, translateWhatsAppBrokerError } from '../../whatsapp-broker-client';
import {
  getWhatsAppTransport,
  type WhatsAppTransport,
  type WhatsAppTransportSendMessagePayload,
} from '../../features/whatsapp-transport';
import type { WhatsAppTransportDependencies } from '../whatsapp-send';
import type { WhatsAppCanonicalError } from '@ticketz/wa-contracts';
import { WhatsAppTransportError } from '@ticketz/wa-contracts';
import { normalizeContactsPayload, normalizeLocationPayload, normalizeTemplatePayload } from '../../utils/message-normalizers';
import {
  assertCircuitClosed,
  buildCircuitBreakerKey,
  getCircuitBreakerConfig,
  recordCircuitFailure,
  recordCircuitSuccess,
} from '../../utils/circuit-breaker';
import { handleDatabaseError, isUniqueViolation } from '../shared/prisma-helpers';

export const emitMessageUpdatedEvents = async (
  tenantId: string,
  ticketId: string,
  message: Message,
  userId?: string | null,
  ticket?: Ticket | null
) => {
  emitTicketEvent(tenantId, ticketId, 'message:updated', message, userId);
  emitTicketEvent(
    tenantId,
    ticketId,
    'message.status.changed',
    {
      ticketId,
      messageId: message.id,
      status: message.status,
    },
    userId
  );

  const resolvedTicket =
    ticket ?? (await storageFindTicketById(tenantId, ticketId).catch(() => Promise.resolve(null)));

  if (resolvedTicket) {
    const providerMessageId = resolveProviderMessageId(message.metadata);
    const messageEnvelope = buildMessageRealtimeEnvelope({
      tenantId,
      ticket: resolvedTicket,
      message,
      instanceId: message.instanceId ?? null,
      providerMessageId,
    });

    emitTicketEvent(
      tenantId,
      ticketId,
      'messages.updated',
      messageEnvelope,
      userId,
      resolveTicketAgreementId(resolvedTicket)
    );

    const ticketEnvelope = buildTicketRealtimeEnvelope({
      tenantId,
      ticket: resolvedTicket,
      message,
      instanceId: message.instanceId ?? null,
      providerMessageId,
    });

    emitTicketRealtimeEnvelope(tenantId, resolvedTicket, ticketEnvelope, userId ?? null);
  }
};


export const sendMessage = async (
  tenantId: string,
  userId: string | undefined,
  input: SendMessageDTO,
  dependencies: WhatsAppTransportDependencies = {}
): Promise<Message> => {
  const ticket = await storageFindTicketById(tenantId, input.ticketId);

  if (!ticket) {
    throw new NotFoundError('Ticket', input.ticketId);
  }

  const inferredInstanceId = resolveWhatsAppInstanceId(ticket);
  const requestedInstanceIdRaw = typeof input.instanceId === 'string' ? input.instanceId.trim() : '';
  const requestedInstanceId = requestedInstanceIdRaw.length > 0 ? requestedInstanceIdRaw : null;

  let effectiveInstanceId = requestedInstanceId ?? inferredInstanceId;
  let overrideRecord: { id: string; brokerId: string | null } | null = null;

  if (requestedInstanceId && requestedInstanceId !== inferredInstanceId) {
    const instance = await prisma.whatsAppInstance.findUnique({
      where: { id: requestedInstanceId },
      select: {
        id: true,
        tenantId: true,
        brokerId: true,
        connected: true,
        status: true,
      },
    });

    if (!instance || instance.tenantId !== tenantId) {
      throw new NotFoundError('WhatsAppInstance', requestedInstanceId);
    }

    const isConnected = instance.connected === true || instance.status === 'connected';
    if (!isConnected) {
      throw new ServiceUnavailableError('A instância selecionada está desconectada no momento.');
    }

    overrideRecord = { id: instance.id, brokerId: instance.brokerId };
    effectiveInstanceId = instance.id;

    logger.info('crm.whatsapp.manual_send.instance_override', {
      tenantId,
      ticketId: ticket.id,
      contactId: ticket.contactId,
      requestedInstanceId,
      defaultInstanceId: inferredInstanceId ?? null,
      userId: userId ?? null,
    });
  }
  const circuitKey =
    effectiveInstanceId && tenantId ? buildCircuitBreakerKey(tenantId, effectiveInstanceId) : null;
  const circuitConfig = getCircuitBreakerConfig();

  let messageRecord: Message | null = null;
  let wasDuplicate = false;
  const direction = input.direction;
  const inferredStatus = direction === 'INBOUND' ? 'SENT' : userId ? 'PENDING' : 'SENT';
  const messageMetadata = {
    ...(input.metadata ?? {}),
  } as Record<string, unknown>;
  mergeEnrichmentMetadata(messageMetadata, input.metadata ?? null, ticket.metadata ?? null);

  if (effectiveInstanceId) {
    const whatsappMetadataSource =
      messageMetadata.whatsapp && typeof messageMetadata.whatsapp === 'object'
        ? (messageMetadata.whatsapp as Record<string, unknown>)
        : {};
    const whatsappMetadata: Record<string, unknown> = { ...whatsappMetadataSource };

    whatsappMetadata.instanceId = effectiveInstanceId;

    if (requestedInstanceId && requestedInstanceId !== inferredInstanceId) {
      whatsappMetadata.instanceOverride = effectiveInstanceId;
      whatsappMetadata.defaultInstanceId = inferredInstanceId ?? null;
      whatsappMetadata.overrideUserId = userId ?? null;
      whatsappMetadata.overrideAt = new Date().toISOString();
    } else if (whatsappMetadata.defaultInstanceId === undefined && inferredInstanceId) {
      whatsappMetadata.defaultInstanceId = inferredInstanceId;
    }

    messageMetadata.whatsapp = whatsappMetadata;
    messageMetadata.sourceInstance = effectiveInstanceId;
  }

  mergeEnrichmentMetadata(messageMetadata);

  try {
    type StorageCreateMessageInput = Parameters<typeof storageCreateMessage>[2];
    const createPayload: StorageCreateMessageInput = {
      ticketId: input.ticketId,
      direction,
      content: input.content ?? input.caption ?? '',
      status: inferredStatus,
      metadata: messageMetadata,
    };

    if (effectiveInstanceId) {
      createPayload.instanceId = effectiveInstanceId;
    }

    if (input.idempotencyKey) {
      createPayload.idempotencyKey = input.idempotencyKey;
    }

    if (typeof input.externalId === 'string' && input.externalId.trim().length > 0) {
      createPayload.externalId = input.externalId.trim();
    }

    if (typeof userId === 'string' && userId.trim().length > 0) {
      createPayload.userId = userId.trim();
    }

    if (input.type !== undefined) {
      createPayload.type = input.type;
    }

    if (input.caption !== undefined) {
      createPayload.caption = input.caption;
    }

    if (input.mediaUrl !== undefined) {
      createPayload.mediaUrl = input.mediaUrl;
    }

    if (input.mediaFileName !== undefined) {
      createPayload.mediaFileName = input.mediaFileName;
    }

    if (input.mediaMimeType !== undefined) {
      createPayload.mediaMimeType = input.mediaMimeType;
    }

    if (input.quotedMessageId !== undefined) {
      createPayload.quotedMessageId = input.quotedMessageId;
    }

    messageRecord = await storageCreateMessage(tenantId, input.ticketId, createPayload);
  } catch (error) {
    if (isUniqueViolation(error) && input.externalId) {
      const existing = await storageFindMessageByExternalId(tenantId, input.externalId);
      if (existing) {
        const merged = await storageUpdateMessage(tenantId, existing.id, {
          metadata: messageMetadata,
          ...(effectiveInstanceId ? { instanceId: effectiveInstanceId } : {}),
        });
        messageRecord = merged ?? existing;
        wasDuplicate = true;
      } else {
        throw new ConflictError('Mensagem duplicada detectada para este ticket.', { cause: error });
      }
    } else {
      handleDatabaseError(error, {
        action: 'createMessage',
        tenantId,
        ticketId: input.ticketId,
      });
      throw error;
    }
  }

  if (!messageRecord) {
    throw new NotFoundError('Ticket', input.ticketId);
  }

  let message = messageRecord;
  let statusChanged = false;

  const emitMessageUpdate =
    dependencies.emitMessageUpdatedEvents ?? emitMessageUpdatedEvents;

  const emitUpdatesIfNeeded = async (): Promise<void> => {
    if (!statusChanged) {
      return;
    }

    statusChanged = false;
    await emitMessageUpdate(tenantId, input.ticketId, message, userId ?? null);
  };

  const ticketSnapshot: Ticket = {
    ...ticket,
    updatedAt: message.updatedAt ?? ticket.updatedAt,
    lastMessageAt: message.createdAt ?? ticket.lastMessageAt,
    lastMessagePreview:
      message.content && message.content.trim().length > 0
        ? message.content.slice(0, 280)
        : ticket.lastMessagePreview,
  };

  const providerMessageId = resolveProviderMessageId(message.metadata);

  if (!wasDuplicate) {
    emitMessageCreatedEvents(tenantId, ticketSnapshot, message, {
      userId: userId ?? null,
      instanceId: effectiveInstanceId ?? null,
      providerMessageId,
    });
  }

  const markAsFailed = async (errorDetails: {
    message: string;
    code?: string;
    status?: number;
    requestId?: string;
    normalized?: WhatsAppCanonicalError | null;
    raw?: { code?: string | null; message?: string | null };
  }) => {
    const currentMetadata = (message.metadata ?? {}) as Record<string, unknown>;
    const previousBroker =
      currentMetadata?.broker && typeof currentMetadata.broker === 'object'
        ? (currentMetadata.broker as Record<string, unknown>)
        : {};

    const errorMetadata: Record<string, unknown> = {
      message: errorDetails.message,
    };

    if (errorDetails.code !== undefined) {
      errorMetadata.code = errorDetails.code;
    }

    if (errorDetails.status !== undefined) {
      errorMetadata.status = errorDetails.status;
    }

    if (errorDetails.requestId !== undefined) {
      errorMetadata.requestId = errorDetails.requestId;
    }

    const metadata = {
      ...currentMetadata,
      broker: {
        ...previousBroker,
        provider: 'whatsapp',
        instanceId: effectiveInstanceId,
        error: errorMetadata,
        failedAt: new Date().toISOString(),
      },
    } as Record<string, unknown>;

    if (errorDetails.normalized) {
      (metadata.broker as Record<string, unknown>).normalizedError = errorDetails.normalized;
    }

    if (errorDetails.raw) {
      (metadata.broker as Record<string, unknown>).rawError = errorDetails.raw;
    }

    let failed: Message | null = null;

    try {
      failed = await storageUpdateMessage(tenantId, message.id, {
        status: 'FAILED',
        metadata,
        ...(effectiveInstanceId ? { instanceId: effectiveInstanceId } : {}),
      });
    } catch (error) {
      handleDatabaseError(error, {
        action: 'markMessageFailed',
        tenantId,
        messageId: message.id,
      });
      throw error;
    }

    if (failed) {
      message = failed;
      statusChanged = true;
    }

    return failed;
  };

  if (ticket.channel === 'WHATSAPP' && direction === 'OUTBOUND') {
    const instanceId = effectiveInstanceId;

    if (!instanceId) {
      logger.warn('whatsapp.outbound.instanceIdMissing', {
        tenantId,
        ticketId: ticket.id,
      });
      await markAsFailed({ message: 'whatsapp_instance_missing' });
    } else {
      const contact = await prisma.contact.findUnique({ where: { id: ticket.contactId } });
      const phone = (contact?.primaryPhone ?? '').trim();

      if (!phone) {
        logger.warn('whatsapp.outbound.contactPhoneMissing', {
          tenantId,
          ticketId: ticket.id,
          contactId: ticket.contactId,
        });
        await markAsFailed({ message: 'contact_phone_missing' });
      } else {
        const transport = dependencies.transport ?? getWhatsAppTransport();
        const requestedInstanceId = instanceId;
        let dispatchInstanceId: string | null = null;
        let dispatchBrokerId: string | null = null;
        try {
          const dispatchResolution = await resolveDispatchInstanceId(instanceId, overrideRecord ?? undefined);
          dispatchInstanceId = dispatchResolution.dispatchInstanceId;
          dispatchBrokerId = dispatchResolution.brokerId;
          if (!dispatchInstanceId) {
            throw new NotFoundError('WhatsAppInstance', instanceId ?? 'unknown');
          }
          logger.info('whatsapp.outbound.dispatch.attempt', {
            tenantId,
            ticketId: ticket.id,
            messageId: message.id,
            requestedInstanceId: instanceId,
            resolvedDispatchId: dispatchInstanceId,
            brokerId: dispatchBrokerId,
          });
         const locationMetadata = normalizeLocationPayload(messageMetadata.location);
         const templateMetadata = normalizeTemplatePayload(messageMetadata.template);
         const contactsMetadata = normalizeContactsPayload(messageMetadata.contacts);
          const transportPayload: WhatsAppTransportSendMessagePayload = {
            to: phone,
            content: input.content ?? input.caption ?? '',
            externalId: message.id,
            metadata: messageMetadata,
          };

          if (typeof input.caption === 'string' && input.caption.trim().length > 0) {
            transportPayload.caption = input.caption;
          }

          if (input.type) {
            transportPayload.type = input.type;
          }

          if (typeof input.mediaUrl === 'string' && input.mediaUrl.trim().length > 0) {
            transportPayload.mediaUrl = input.mediaUrl;
          }

          if (typeof input.mediaMimeType === 'string' && input.mediaMimeType.trim().length > 0) {
            transportPayload.mediaMimeType = input.mediaMimeType;
          }

          if (typeof input.mediaFileName === 'string' && input.mediaFileName.trim().length > 0) {
            transportPayload.mediaFileName = input.mediaFileName;
          }

          if (typeof messageMetadata.previewUrl === 'boolean') {
            transportPayload.previewUrl = messageMetadata.previewUrl;
          }

          if (locationMetadata) {
            transportPayload.location = locationMetadata;
          }

          if (templateMetadata) {
            transportPayload.template = templateMetadata;
          }

          if (contactsMetadata) {
            transportPayload.contacts = contactsMetadata;
          }

          const dispatchResult = await transport.sendMessage(
            dispatchInstanceId,
            transportPayload,
            { idempotencyKey: message.id }
          );

          const brokerMetadata: Record<string, unknown> = {
            provider: 'whatsapp',
            instanceId,
            externalId: dispatchResult.externalId,
            status: dispatchResult.status,
            dispatchedAt: dispatchResult.timestamp,
          };

          if (dispatchResult.raw) {
            brokerMetadata.raw = dispatchResult.raw;
          }

          const metadata: Record<string, unknown> = {
            ...(message.metadata ?? {}),
            broker: brokerMetadata,
          };

          let updated: Message | null = null;

          try {
            updated = await storageUpdateMessage(tenantId, message.id, {
              status: normalizeBrokerStatus(dispatchResult.status),
              externalId: dispatchResult.externalId,
              metadata,
              ...(instanceId ? { instanceId } : {}),
            });
          } catch (error) {
            handleDatabaseError(error, {
              action: 'applyBrokerAck',
              tenantId,
              messageId: message.id,
            });
            throw error;
          }

          if (updated) {
            message = updated;
            statusChanged = true;
          }

          if (circuitKey) {
            const wasOpen = recordCircuitSuccess(circuitKey);
            if (wasOpen) {
              logger.info('whatsapp.outbound.circuit.closed', {
                tenantId,
                ticketId: ticket.id,
                instanceId,
                requestedInstanceId,
                resolvedDispatchId: dispatchInstanceId,
                brokerId: dispatchBrokerId,
              });
              emitToTenant(tenantId, 'whatsapp.circuit_breaker.closed', {
                instanceId,
                timestamp: new Date().toISOString(),
              });
            }
          }
        } catch (error) {
          const transportError = error instanceof WhatsAppTransportError ? error : null;
          const brokerError = error instanceof WhatsAppBrokerError ? error : null;
          const normalizedBrokerError = translateWhatsAppBrokerError(brokerError);
          const normalizedTransportError = transportError?.canonical ?? normalizedBrokerError;
          const reason =
            normalizedTransportError?.message ??
            (error instanceof Error ? error.message : 'unknown_error');
          const status =
            typeof transportError?.status === 'number'
              ? transportError.status
              : typeof brokerError?.brokerStatus === 'number'
              ? brokerError.brokerStatus
              : undefined;
          const rawErrorCode = transportError?.code ?? brokerError?.code;
          const canonicalCode =
            normalizedTransportError?.code ??
            (typeof rawErrorCode === 'string' ? rawErrorCode.toUpperCase() : null);
          const code = canonicalCode ?? rawErrorCode;
          const requestId = transportError?.requestId ?? brokerError?.requestId;
          const normalizedCode = typeof code === 'string' ? code.toUpperCase() : null;

          logger.error('whatsapp.outbound.dispatch.failed', {
            tenantId,
            ticketId: ticket.id,
            messageId: message.id,
            error: reason,
            errorCode: code,
            status,
            requestId,
            rawErrorCode,
            requestedInstanceId,
            resolvedDispatchId: dispatchInstanceId,
            brokerId: dispatchBrokerId,
          });
          if (normalizedCode === 'INSTANCE_NOT_CONNECTED') {
            whatsappSocketReconnectsCounter.inc({
              origin: 'ticket-service',
              tenantId,
              instanceId: instanceId ?? 'unknown',
              reason: 'INSTANCE_NOT_CONNECTED',
            });
          }
          const failurePayload: Parameters<typeof markAsFailed>[0] = {
            message: reason,
          };

          if (typeof code === 'string') {
            failurePayload.code = code;
          }

          if (typeof status === 'number') {
            failurePayload.status = status;
          }

          if (requestId) {
            failurePayload.requestId = requestId;
          }

          if (normalizedTransportError) {
            failurePayload.normalized = normalizedTransportError;
          }

          if (transportError) {
            failurePayload.raw = {
              code: transportError.code,
              message: error instanceof Error ? error.message : null,
            };
          } else if (brokerError) {
            failurePayload.raw = {
              code: brokerError.code ?? null,
              message: error instanceof Error ? error.message : null,
            };
          }

          await markAsFailed(failurePayload);

          if (circuitKey) {
            const result = recordCircuitFailure(circuitKey);
            if (result.opened) {
              const retryAtIso = result.retryAt ? new Date(result.retryAt).toISOString() : null;
              logger.warn('whatsapp.outbound.circuit.opened', {
                tenantId,
                ticketId: ticket.id,
                instanceId,
                failureCount: result.failureCount,
                retryAt: retryAtIso,
              });
              emitToTenant(tenantId, 'whatsapp.circuit_breaker.open', {
                instanceId,
                failureCount: result.failureCount,
                windowMs: circuitConfig.windowMs,
                cooldownMs: circuitConfig.cooldownMs,
                retryAt: retryAtIso,
              });
            }
          }

          await emitUpdatesIfNeeded();
          throw error;
        }
      }
    }
  }

  await emitUpdatesIfNeeded();

  return message;
};

