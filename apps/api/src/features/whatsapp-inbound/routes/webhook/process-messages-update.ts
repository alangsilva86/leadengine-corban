import type { Prisma } from '@prisma/client';

import { logger } from '../../../../config/logger';
import { whatsappWebhookEventsCounter } from '../../../../lib/metrics';
import { prisma } from '../../../../lib/prisma';
import {
  applyBrokerAck,
  findMessageByExternalId as storageFindMessageByExternalId,
} from '@ticketz/storage';

import { emitMessageUpdatedEvents } from '../../../../services/ticket-service';
import { normalizeBaileysMessageStatus } from '../../services/baileys-status-normalizer';
import type { RawBaileysUpsertEvent } from '../../services/baileys-raw-normalizer';
import { buildIdempotencyKey, registerIdempotency } from '../../utils/webhook-idempotency';
import { normalizeChatId } from '../../utils/poll-helpers';
import { asRecord, readString } from '../../utils/webhook-parsers';
import { parseTimestampToDate, sanitizeMetadataValue } from './helpers';

export type MessageLookupResult = {
  tenantId: string;
  messageId: string;
  ticketId: string;
  metadata: Record<string, unknown>;
  instanceId: string | null;
  externalId: string | null;
};

const ACK_RANK: Record<string, number> = { SENT: 1, DELIVERED: 2, READ: 3 };
const ackRank = (status: string | null | undefined): number => {
  if (!status) return 0;
  const key = status.toString().toUpperCase();
  return ACK_RANK[key] ?? 0;
};

export const findMessageForStatusUpdate = async ({
  tenantId,
  messageId,
  ticketId,
}: {
  tenantId?: string | null;
  messageId: string;
  ticketId?: string | null;
}): Promise<MessageLookupResult | null> => {
  const trimmedId = messageId.trim();
  if (!trimmedId) {
    return null;
  }

  if (tenantId) {
    const message = await storageFindMessageByExternalId(tenantId, trimmedId);
    if (message) {
      const metadataRecord =
        message.metadata && typeof message.metadata === 'object' && !Array.isArray(message.metadata)
          ? { ...(message.metadata as Record<string, unknown>) }
          : ({} as Record<string, unknown>);

      return {
        tenantId: message.tenantId,
        messageId: message.id,
        ticketId: message.ticketId,
        metadata: metadataRecord,
        instanceId: message.instanceId ?? null,
        externalId: message.externalId ?? null,
      };
    }
  }

  const where: Prisma.MessageWhereInput = {
    OR: [
      { externalId: trimmedId },
      { metadata: { path: ['broker', 'messageId'], equals: trimmedId } },
    ],
  };

  if (tenantId) {
    where.tenantId = tenantId;
  }

  if (ticketId) {
    where.ticketId = ticketId;
  }

  const fallback = await prisma.message.findFirst({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      tenantId: true,
      ticketId: true,
      metadata: true,
      instanceId: true,
      externalId: true,
    },
  });

  if (!fallback) {
    return null;
  }

  const metadataRecord =
    fallback.metadata && typeof fallback.metadata === 'object' && !Array.isArray(fallback.metadata)
      ? { ...(fallback.metadata as Record<string, unknown>) }
      : ({} as Record<string, unknown>);

  return {
    tenantId: fallback.tenantId,
    messageId: fallback.id,
    ticketId: fallback.ticketId,
    metadata: metadataRecord,
    instanceId: fallback.instanceId ?? null,
    externalId: fallback.externalId ?? null,
  };
};

export const processMessagesUpdate = async (
  eventRecord: RawBaileysUpsertEvent,
  envelopeRecord: Record<string, unknown>,
  context: {
    requestId: string;
    instanceId?: string | null;
    tenantOverride?: string | null;
  }
): Promise<{ persisted: number; failures: number }> => {
  const payloadRecord = asRecord((eventRecord as { payload?: unknown }).payload);
  const rawRecord = asRecord(payloadRecord?.raw);
  const updates = Array.isArray(rawRecord?.updates) ? rawRecord.updates : [];

  if (!updates.length) {
    return { persisted: 0, failures: 0 };
  }

  const tenantCandidate =
    context.tenantOverride ??
    readString(
      (eventRecord as { tenantId?: unknown }).tenantId,
      payloadRecord?.tenantId,
      rawRecord?.tenantId,
      envelopeRecord.tenantId
    );

  const ticketCandidate = readString(
    payloadRecord?.ticketId,
    rawRecord?.ticketId,
    (payloadRecord?.ticket as { id?: unknown })?.id
  );

  let persisted = 0;
  let failures = 0;

  for (const entry of updates) {
    const updateRecord = asRecord(entry);
    if (!updateRecord) {
      continue;
    }

    const keyRecord = asRecord(updateRecord.key);
    const updateDetails = asRecord(updateRecord.update);
    const messageId = readString(
      updateDetails?.id,
      updateRecord.id,
      keyRecord?.id,
      (updateDetails as { key?: { id?: unknown } })?.key?.id
    );

    if (!messageId) {
      continue;
    }

    const fromMe = Boolean(keyRecord?.fromMe ?? updateRecord.fromMe);
    if (!fromMe) {
      continue;
    }

    const ackIdemKey = buildIdempotencyKey(
      tenantCandidate ?? 'unknown',
      context.instanceId ?? null,
      messageId,
      0
    );
    if (!registerIdempotency(ackIdemKey)) {
      whatsappWebhookEventsCounter.inc({
        origin: 'webhook',
        tenantId: tenantCandidate ?? 'unknown',
        instanceId: context.instanceId ?? 'unknown',
        result: 'ignored',
        reason: 'ack_duplicate',
      });
      continue;
    }

    const statusValue =
      updateDetails?.status ?? updateRecord.status ?? (updateDetails as { ack?: unknown })?.ack;
    const normalizedStatus = normalizeBaileysMessageStatus(statusValue);
    const numericStatus =
      typeof statusValue === 'number'
        ? statusValue
        : typeof statusValue === 'string'
        ? Number(statusValue)
        : undefined;

    const timestampCandidate =
      updateDetails?.messageTimestamp ?? updateDetails?.timestamp ?? updateRecord.timestamp;
    const ackTimestamp = parseTimestampToDate(timestampCandidate) ?? new Date();
    const participant = readString(updateDetails?.participant, updateRecord.participant);
    const remoteJid =
      normalizeChatId(readString(keyRecord?.remoteJid, updateRecord.remoteJid, participant, updateDetails?.jid)) ?? null;

    let lookup: MessageLookupResult | null = null;

    try {
      lookup = await findMessageForStatusUpdate({
        tenantId: tenantCandidate,
        messageId,
        ticketId: readString(updateRecord.ticketId, ticketCandidate),
      });

      if (!lookup) {
        whatsappWebhookEventsCounter.inc({
          origin: 'webhook',
          tenantId: tenantCandidate ?? 'unknown',
          instanceId: context.instanceId ?? 'unknown',
          result: 'ignored',
          reason: 'ack_message_not_found',
        });
        logger.debug('WhatsApp status update ignored; message not found', {
          requestId: context.requestId,
          messageId,
          tenantId: tenantCandidate ?? 'unknown',
        });
        continue;
      }

      try {
        const prevBroker =
          lookup.metadata?.broker && typeof lookup.metadata.broker === 'object'
            ? (lookup.metadata.broker as Record<string, unknown>)
            : undefined;

        const prevStatusRaw =
          prevBroker && typeof prevBroker.lastAck === 'object'
            ? (prevBroker.lastAck as Record<string, unknown>).status
            : undefined;

        const prevStatus = normalizeBaileysMessageStatus(prevStatusRaw);
        const prevRank = ackRank(prevStatus);
        const newRank = ackRank(normalizedStatus);

        if (prevRank > 0 && newRank > 0 && newRank < prevRank) {
          whatsappWebhookEventsCounter.inc({
            origin: 'webhook',
            tenantId: lookup.tenantId ?? 'unknown',
            instanceId: context.instanceId ?? lookup.instanceId ?? 'unknown',
            result: 'ignored',
            reason: 'ack_regression',
          });
          logger.debug('ACK regression ignored', {
            requestId: context.requestId,
            messageId,
            prevStatus,
            nextStatus: normalizedStatus,
          });
          continue;
        }

        const prevReceivedAtIso =
          prevBroker && typeof prevBroker.lastAck === 'object'
            ? (prevBroker.lastAck as Record<string, unknown>).receivedAt
            : undefined;

        if (typeof prevReceivedAtIso === 'string') {
          const prevTs = Date.parse(prevReceivedAtIso);
          const newTs = ackTimestamp.getTime();
          if (Number.isFinite(prevTs) && prevTs - newTs > 10 * 60 * 1000) {
            whatsappWebhookEventsCounter.inc({
              origin: 'webhook',
              tenantId: lookup.tenantId ?? 'unknown',
              instanceId: context.instanceId ?? lookup.instanceId ?? 'unknown',
              result: 'ignored',
              reason: 'ack_late',
            });
            logger.debug('ACK late arrival ignored', {
              requestId: context.requestId,
              messageId,
              prevReceivedAtIso,
              newAckAt: ackTimestamp.toISOString(),
            });
            continue;
          }
        }
      } catch {
        // ignore defensive check failures
      }

      const metadataRecord = lookup.metadata ?? {};
      const existingBroker =
        metadataRecord.broker && typeof metadataRecord.broker === 'object' && !Array.isArray(metadataRecord.broker)
          ? { ...(metadataRecord.broker as Record<string, unknown>) }
          : ({} as Record<string, unknown>);

      const brokerMetadata: Record<string, unknown> = {
        ...existingBroker,
        provider: 'whatsapp',
        status: normalizedStatus,
        messageId: existingBroker.messageId ?? lookup.externalId ?? messageId,
      };

      if (context.instanceId ?? lookup.instanceId ?? existingBroker.instanceId) {
        brokerMetadata.instanceId = context.instanceId ?? lookup.instanceId ?? existingBroker.instanceId;
      }

      if (remoteJid) {
        brokerMetadata.remoteJid = remoteJid;
      }

      const lastAck: Record<string, unknown> = {
        status: normalizedStatus,
        receivedAt: ackTimestamp.toISOString(),
        raw: sanitizeMetadataValue(updateRecord),
      };

      if (participant) {
        lastAck.participant = participant;
      }

      if (Number.isFinite(numericStatus)) {
        lastAck.numericStatus = Number(numericStatus);
      }

      brokerMetadata.lastAck = lastAck;

      const metadataUpdate: Record<string, unknown> = {
        broker: brokerMetadata,
      };

      const ackInput: Parameters<typeof applyBrokerAck>[2] = {
        status: normalizedStatus,
        metadata: metadataUpdate,
      };

      if (normalizedStatus === 'DELIVERED' || normalizedStatus === 'READ') {
        ackInput.deliveredAt = ackTimestamp;
      }

      if (normalizedStatus === 'READ') {
        ackInput.readAt = ackTimestamp;
      }

      const ackInstanceId = context.instanceId ?? lookup.instanceId;
      const metricsInstanceId = ackInstanceId ?? 'unknown';
      if (ackInstanceId !== undefined && ackInstanceId !== null) {
        ackInput.instanceId = ackInstanceId;
      }

      const updated = await applyBrokerAck(lookup.tenantId, lookup.messageId, ackInput);

      if (updated) {
        persisted += 1;
        await emitMessageUpdatedEvents(lookup.tenantId, updated.ticketId, updated, null);
        whatsappWebhookEventsCounter.inc({
          origin: 'webhook',
          tenantId: lookup.tenantId ?? 'unknown',
          instanceId: metricsInstanceId,
          result: 'accepted',
          reason: 'ack_applied',
        });
      } else {
        whatsappWebhookEventsCounter.inc({
          origin: 'webhook',
          tenantId: lookup.tenantId ?? 'unknown',
          instanceId: metricsInstanceId,
          result: 'ignored',
          reason: 'ack_noop',
        });
      }
    } catch (error) {
      failures += 1;
      whatsappWebhookEventsCounter.inc({
        origin: 'webhook',
        tenantId: lookup?.tenantId ?? tenantCandidate ?? 'unknown',
        instanceId: context.instanceId ?? lookup?.instanceId ?? 'unknown',
        result: 'failed',
        reason: 'ack_error',
      });
      logger.error('Failed to apply WhatsApp status update', {
        requestId: context.requestId,
        messageId,
        tenantId: lookup?.tenantId ?? tenantCandidate ?? 'unknown',
        error,
      });
    }
  }

  return { persisted, failures };
};
