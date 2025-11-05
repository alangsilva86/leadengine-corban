import { logger } from '../../../../config/logger';
import {
  getDefaultInstanceId,
  getDefaultTenantId,
} from '../../../../config/whatsapp';
import { whatsappWebhookEventsCounter } from '../../../../lib/metrics';
import { emitWhatsAppDebugPhase } from '../../../debug/services/whatsapp-debug-emitter';
import { enqueueInboundWebhookJob } from '../../services/inbound-queue';
import { recordEncryptedPollVote } from '../../services/poll-choice-service';
import { upsertPollMetadata, type PollMetadataOption } from '../../services/poll-metadata-service';
import { pollRuntimeService } from '../../services/poll-runtime-service';
import { logBaileysDebugEvent } from '../../utils/baileys-event-logger';
import type { NormalizedRawUpsertMessage } from '../../services/baileys-raw-normalizer';
import { asRecord, readNumber, readString } from '../../utils/webhook-parsers';
import { normalizeChatId } from '../../utils/poll-helpers';
import { toRawPreview } from './helpers';
import { getAiRoutingPreferences } from '../../../../config/ai-route';

type ProcessNormalizedMessageOptions = {
  normalized: NormalizedRawUpsertMessage;
  eventRecord: Record<string, unknown>;
  envelopeRecord: Record<string, unknown>;
  rawPreview: string;
  requestId: string;
  tenantOverride?: string | null;
  instanceOverride?: string | null;
};

export const processNormalizedMessage = async (
  options: ProcessNormalizedMessageOptions
): Promise<boolean> => {
  const { normalized, eventRecord, envelopeRecord, rawPreview, requestId } = options;
  const { mode: aiRouteMode, skipServerAutoReply } = getAiRoutingPreferences();
  const aiRouteIsFront = aiRouteMode === 'front';

  const tenantId =
    options.tenantOverride ??
    normalized.tenantId ??
    readString((eventRecord as { tenantId?: unknown }).tenantId, envelopeRecord.tenantId) ??
    getDefaultTenantId();

  const instanceId =
    readString(
      options.instanceOverride,
      normalized.data.instanceId,
      (eventRecord as { instanceId?: unknown }).instanceId,
      envelopeRecord.instanceId
    ) ?? getDefaultInstanceId();

  const metadataContactRecord = asRecord(normalized.data.metadata?.contact);
  const messageRecord = (normalized.data.message ?? {}) as Record<string, unknown>;
  const messageKeyRecord = asRecord(messageRecord.key);
  const fromRecord = asRecord(normalized.data.from);

  const chatIdCandidate =
    normalizeChatId(
      readString(metadataContactRecord?.remoteJid) ??
        readString(metadataContactRecord?.jid) ??
        readString(messageKeyRecord?.remoteJid) ??
        readString(fromRecord?.phone) ??
        readString(messageKeyRecord?.id)
    ) ?? normalizeChatId(readString(fromRecord?.phone));

  const chatId = chatIdCandidate ?? `${tenantId}@baileys`;

  try {
    const data = normalized.data;
    const metadataBase =
      data.metadata && typeof data.metadata === 'object' && !Array.isArray(data.metadata)
        ? { ...(data.metadata as Record<string, unknown>) }
        : ({} as Record<string, unknown>);
    const metadataContact = asRecord(metadataBase.contact);
    const messageKey = messageKeyRecord ?? {};
    const contactRecord = asRecord(data.from) ?? {};

    const remoteJid =
      normalizeChatId(
        readString(messageKey.remoteJid) ??
          readString(metadataContact?.jid) ??
          readString(metadataContact?.remoteJid) ??
          readString(
            (eventRecord as {
              payload?: { messages?: Array<{ key?: { remoteJid?: string } }> };
            })?.payload?.messages?.[normalized.messageIndex ?? 0]?.key?.remoteJid
          )
      ) ?? chatId;

    const direction =
      (data.direction ?? 'inbound').toString().toUpperCase() === 'OUTBOUND' ? 'OUTBOUND' : 'INBOUND';
    const externalId = readString(messageRecord.id, messageKey.id, normalized.messageId);
    const timestamp = readString(data.timestamp) ?? null;

    const pollCreationRecord = asRecord(messageRecord.pollCreationMessage);
    if (pollCreationRecord) {
      const metadataOptions = Array.isArray(pollCreationRecord.options)
        ? (pollCreationRecord.options as Array<Record<string, unknown>>)
            .map((entry, index) => {
              const optionId =
                readString(
                  entry.id,
                  (entry as { optionName?: unknown }).optionName,
                  (entry as { title?: unknown }).title
                ) ?? `option_${index}`;
              const title =
                readString(
                  (entry as { title?: unknown }).title,
                  (entry as { optionName?: unknown }).optionName,
                  (entry as { name?: unknown }).name,
                  (entry as { description?: unknown }).description
                ) ?? null;
              const normalizedOption: PollMetadataOption = {
                id: optionId,
                title,
                index: readNumber((entry as { index?: unknown }).index) ?? index,
              };
              const optionName = readString((entry as { optionName?: unknown }).optionName);
              if (optionName && optionName !== title) {
                normalizedOption.optionName = optionName;
              }
              const description = readString((entry as { description?: unknown }).description);
              if (description && description !== title) {
                normalizedOption.description = description;
              }
              return normalizedOption;
            })
            .filter(Boolean) as PollMetadataOption[]
        : [];

      const pollContext = asRecord(messageRecord.pollContextInfo);
      const creationKey = {
        remoteJid:
          readString(messageKey.remoteJid, metadataContact?.remoteJid, metadataContact?.jid) ??
          remoteJid ??
          null,
        participant:
          readString(messageKey.participant, metadataContact?.participant) ??
          null,
        fromMe: messageKey.fromMe === true,
      };

      try {
        await upsertPollMetadata({
          pollId: normalized.messageId,
          question:
            readString(messageRecord.text, pollCreationRecord.name, pollCreationRecord.title) ?? null,
          selectableOptionsCount: readNumber(pollCreationRecord.selectableOptionsCount),
          allowMultipleAnswers: pollCreationRecord.allowMultipleAnswers === true,
          options: metadataOptions,
          creationMessageId: normalized.messageId,
          creationMessageKey: creationKey,
          messageSecret: readString(pollContext?.messageSecret),
          messageSecretVersion: readNumber(pollContext?.messageSecretVersion),
          tenantId: tenantId ?? null,
          instanceId: instanceId ?? null,
        });

        await pollRuntimeService.rememberPollCreation({
          pollId: normalized.messageId,
          question:
            readString(messageRecord.text, pollCreationRecord.name, pollCreationRecord.title) ?? null,
          selectableOptionsCount: readNumber(pollCreationRecord.selectableOptionsCount),
          allowMultipleAnswers: pollCreationRecord.allowMultipleAnswers === true,
          options: metadataOptions,
          creationMessageId: normalized.messageId,
          creationMessageKey: creationKey,
          messageSecret: readString(pollContext?.messageSecret),
          messageSecretVersion: readNumber(pollContext?.messageSecretVersion),
          tenantId: tenantId ?? null,
          instanceId: instanceId ?? null,
          rawMessage: messageRecord,
          creatorJid: creationKey.participant ?? remoteJid ?? null,
        });
      } catch (metadataError) {
        logger.warn('Failed to persist poll metadata from webhook message', {
          requestId,
          pollId: normalized.messageId,
          tenantId,
          instanceId,
          error: metadataError,
        });
      }
    }

    const brokerMetadata =
      metadataBase.broker && typeof metadataBase.broker === 'object' && !Array.isArray(metadataBase.broker)
        ? { ...(metadataBase.broker as Record<string, unknown>) }
        : ({} as Record<string, unknown>);
    const pollUpdateRecord = asRecord(messageRecord.pollUpdateMessage);
    if (pollUpdateRecord) {
      const pollUpdateVote = asRecord(pollUpdateRecord.vote);
      const pollCreationKeyRecord = asRecord(pollUpdateRecord.pollCreationMessageKey);
      const pollIdFromUpdate =
        readString(
          pollUpdateRecord.pollCreationMessageId,
          pollCreationKeyRecord?.id
        ) ?? null;

      try {
        await recordEncryptedPollVote({
          pollId: pollIdFromUpdate ?? normalized.messageId,
          voterJid: remoteJid,
          messageId: externalId,
          encryptedVote: pollUpdateVote
            ? {
                encPayload: readString(pollUpdateVote.encPayload),
                encIv: readString(pollUpdateVote.encIv),
                ciphertext: readString(pollUpdateVote.ciphertext),
              }
            : null,
          timestamp,
        });
      } catch (encryptedVoteError) {
        logger.warn('Failed to persist encrypted poll vote details', {
          requestId,
          pollId: pollIdFromUpdate ?? normalized.messageId,
          voterJid: remoteJid,
          error: encryptedVoteError,
        });
      }

      try {
        await pollRuntimeService.registerReceiptHint({
          pollId: pollIdFromUpdate ?? normalized.messageId,
          hintJid: remoteJid,
        });
      } catch (runtimeError) {
        logger.warn('Failed to register poll receipt hint', {
          requestId,
          pollId: pollIdFromUpdate ?? normalized.messageId,
          voterJid: remoteJid,
          error: runtimeError instanceof Error ? runtimeError.message : String(runtimeError),
        });
      }
    }

    const existingBrokerMessageType = brokerMetadata.messageType;
    const messageUpsertType = normalized.messageUpsertType;
    if (messageUpsertType !== null) {
      brokerMetadata.messageType = messageUpsertType;
    } else if (brokerMetadata.messageType === undefined) {
      brokerMetadata.messageType = null;
    }

    if (normalized.messageType) {
      brokerMetadata.messageContentType =
        brokerMetadata.messageContentType ??
        (typeof existingBrokerMessageType === 'string' ? existingBrokerMessageType : undefined) ??
        normalized.messageType;
    }

    brokerMetadata.instanceId = brokerMetadata.instanceId ?? instanceId ?? null;
    brokerMetadata.sessionId = brokerMetadata.sessionId ?? normalized.sessionId ?? null;
    brokerMetadata.brokerId = brokerMetadata.brokerId ?? normalized.brokerId ?? null;
    brokerMetadata.origin = brokerMetadata.origin ?? 'webhook';

    const metadata: Record<string, unknown> = {
      ...metadataBase,
      // identify webhook origin and, if applicable, front-first route for observability
      source: metadataBase.source ?? (aiRouteIsFront ? 'baileys:webhook:front_first' : 'baileys:webhook'),
      direction,
      remoteJid: metadataBase.remoteJid ?? remoteJid,
      chatId: metadataBase.chatId ?? chatId,
      tenantId: metadataBase.tenantId ?? tenantId,
      instanceId: metadataBase.instanceId ?? instanceId ?? null,
      sessionId: metadataBase.sessionId ?? normalized.sessionId ?? null,
      normalizedIndex: normalized.messageIndex,
      raw: metadataBase.raw ?? rawPreview,
      broker: brokerMetadata,
      // new: routing hints for downstream processors and UI
      aiRouteMode: aiRouteMode,
      flags: {
        ...(typeof (metadataBase as Record<string, unknown>)?.flags === 'object' && !Array.isArray((metadataBase as Record<string, unknown>)?.flags)
          ? ((metadataBase as Record<string, unknown>)?.flags as Record<string, unknown>)
          : {}),
        // when front-first, signal backend processors to avoid auto IA reply here
        skipServerAi: skipServerAutoReply,
      },
    };

    emitWhatsAppDebugPhase({
      phase: 'webhook:normalized',
      correlationId: normalized.messageId ?? externalId ?? requestId ?? null,
      tenantId: tenantId ?? null,
      instanceId: instanceId ?? null,
      chatId,
      tags: ['webhook', aiRouteMode],
      context: {
        requestId,
        normalizedIndex: normalized.messageIndex,
        direction,
        source: 'webhook',
        routeMode: aiRouteMode,
      },
      payload: {
        contact: contactRecord,
        message: messageRecord,
        metadata,
      },
    });

    const metadataSource = readString(metadata.source);
    const debugSource =
      metadataSource && metadataSource.toLowerCase().includes('baileys')
        ? metadataSource
        : 'baileys:webhook';

    if (debugSource) {
      await logBaileysDebugEvent(debugSource, {
        tenantId: tenantId ?? null,
        instanceId: instanceId ?? null,
        chatId,
        messageId: normalized.messageId ?? externalId ?? null,
        direction,
        timestamp,
        metadata,
        contact: contactRecord,
        message: messageRecord,
        rawPayload: toRawPreview(eventRecord),
        rawEnvelope: toRawPreview(envelopeRecord),
        normalizedIndex: normalized.messageIndex,
      });
    }

    whatsappWebhookEventsCounter.inc({
      origin: 'webhook',
      tenantId: tenantId ?? 'unknown',
      instanceId: instanceId ?? 'unknown',
      result: 'accepted',
      reason: aiRouteIsFront ? 'routed_front' : 'routed_server',
    });

    enqueueInboundWebhookJob({
      requestId,
      tenantId,
      instanceId,
      chatId,
      normalizedIndex: normalized.messageIndex ?? null,
      route: aiRouteMode,
      envelope: {
        origin: 'webhook',
        instanceId: instanceId ?? 'unknown-instance',
        chatId,
        tenantId,
        message: {
          kind: 'message',
          id: normalized.messageId ?? null,
          externalId,
          brokerMessageId: normalized.messageId,
          timestamp,
          direction,
          contact: contactRecord,
          payload: messageRecord,
          metadata,
        },
        raw: {
          event: eventRecord,
          normalizedIndex: normalized.messageIndex,
        },
      },
    });

    return true;
  } catch (error) {
    logger.error('Failed to persist inbound WhatsApp message', {
      requestId,
      tenantId,
      chatId,
      error,
    });
    whatsappWebhookEventsCounter.inc({
      origin: 'webhook',
      tenantId: tenantId ?? 'unknown',
      instanceId: instanceId ?? 'unknown',
      result: 'failed',
      reason: 'persist_error',
    });
    return false;
  }
};

export type { ProcessNormalizedMessageOptions };
