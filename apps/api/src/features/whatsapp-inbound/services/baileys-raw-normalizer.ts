import { randomUUID } from 'node:crypto';

import { logger } from '../../../config/logger';

import type { BrokerWebhookInbound, BrokerInboundContact } from '../schemas/broker-contracts';

type UnknownRecord = Record<string, unknown>;

export interface RawBaileysUpsertEvent extends UnknownRecord {
  event?: unknown;
  iid?: unknown;
  instanceId?: unknown;
  payload?: unknown;
}

export interface NormalizedRawUpsertMessage {
  data: BrokerWebhookInbound;
  messageIndex: number;
  tenantId?: string;
  sessionId?: string;
  brokerId?: string | null;
  messageId: string;
  messageType: string;
  isGroup: boolean;
}

export interface IgnoredRawUpsertMessage {
  messageIndex: number;
  reason: string;
  details?: UnknownRecord;
}

export interface NormalizeUpsertResult {
  normalized: NormalizedRawUpsertMessage[];
  ignored: IgnoredRawUpsertMessage[];
}

export interface NormalizeUpsertOverrides {
  instanceId?: string | null;
  tenantId?: string | null;
  sessionId?: string | null;
  brokerId?: string | null;
}

const asRecord = (value: unknown): UnknownRecord | null => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as UnknownRecord;
  }
  return null;
};

const asArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) {
    return value;
  }
  return [];
};

const readString = (...candidates: unknown[]): string | null => {
  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }
  return null;
};

const readNumber = (...candidates: unknown[]): number | null => {
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate;
    }
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      const parsed = Number(candidate);
      if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
};

const normalizeRemoteJid = (input: unknown): string | null => {
  if (typeof input !== 'string') {
    return null;
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const withoutDomain = trimmed.replace(/@.+$/u, '');
  const digitsOnly = withoutDomain.replace(/\D+/gu, '');

  if (digitsOnly.length >= 8) {
    return digitsOnly;
  }

  return withoutDomain || null;
};

const compactRecord = (input: UnknownRecord): UnknownRecord => {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined)
  );
};

const toIsoTimestamp = (value: number | null): string | null => {
  if (value === null) {
    return null;
  }
  const ms = value > 1_000_000_000_000 ? value : value * 1000;
  try {
    return new Date(ms).toISOString();
  } catch {
    return null;
  }
};

const unwrapMessageContent = (message: UnknownRecord | null): UnknownRecord | null => {
  if (!message) {
    return null;
  }

  let current: UnknownRecord | null = message;
  const visited = new Set<UnknownRecord>();

  while (current && !visited.has(current)) {
    visited.add(current);
    const ephemeral = asRecord(current.ephemeralMessage);
    if (ephemeral) {
      const nested = asRecord(ephemeral.message);
      if (nested) {
        current = nested;
        continue;
      }
    }

    const viewOnce = asRecord(current.viewOnceMessage);
    if (viewOnce) {
      const nested = asRecord(viewOnce.message);
      if (nested) {
        current = nested;
        continue;
      }
    }

    const viewOnceV2 = asRecord(current.viewOnceMessageV2);
    if (viewOnceV2) {
      const nested = asRecord(viewOnceV2.message);
      if (nested) {
        current = nested;
        continue;
      }
    }

    break;
  }

  return current;
};

const extractContextInfo = (content: UnknownRecord): UnknownRecord | null => {
  if ('contextInfo' in content) {
    const context = asRecord(content.contextInfo);
    if (context) {
      return context;
    }
  }

  for (const value of Object.values(content)) {
    if (!value || typeof value !== 'object') {
      continue;
    }
    const record = asRecord(value);
    if (!record) {
      continue;
    }
    if ('contextInfo' in record) {
      const context = asRecord(record.contextInfo);
      if (context) {
        return context;
      }
    }
  }

  return null;
};

const extractQuotedDetails = (content: UnknownRecord): UnknownRecord | null => {
  const context = extractContextInfo(content);
  if (!context) {
    return null;
  }

  const quoted = asRecord(context.quotedMessage);
  if (!quoted) {
    return null;
  }

  const unwrapped = unwrapMessageContent(quoted);
  if (!unwrapped) {
    return {
      quotedMessageId: readString(
        context.stanzaId,
        context.stanzaID,
        context.quotedMessageId,
        context.quotedMessageID
      ),
      quotedParticipant: readString(context.participant),
      quotedText: null,
    };
  }

  const quotedText =
    readString(unwrapped.conversation) ||
    readString(asRecord(unwrapped.extendedTextMessage)?.text) ||
    readString(asRecord(unwrapped.buttonsMessage)?.contentText) ||
    null;

  return compactRecord({
    quotedMessageId: readString(
      context.stanzaId,
      context.stanzaID,
      context.quotedMessageId,
      context.quotedMessageID
    ),
    quotedParticipant: readString(context.participant),
    quotedText,
  });
};

const extractMediaDetails = (message: UnknownRecord, key: string): UnknownRecord | null => {
  const raw = asRecord(message[key]);
  if (!raw) {
    return null;
  }

  const captionSource = asRecord(raw.contextInfo)?.quotedMessage;
  const captionFallback =
    typeof raw.caption === 'string' && raw.caption.trim().length > 0 ? raw.caption.trim() : undefined;

  const mediaCaption =
    readString(raw.caption) ||
    readString(asRecord(raw.captionMessage)?.text) ||
    readString(asRecord(unwrapMessageContent(asRecord(captionSource)))?.conversation) ||
    captionFallback ||
    null;

  return compactRecord({
    mimetype: readString(raw.mimetype),
    caption: mediaCaption ?? undefined,
    fileLength: readNumber(raw.fileLength),
    fileName: readString(raw.fileName, raw.fileNameEncryptedSha256),
    mediaKey: readString(raw.mediaKey),
    directPath: readString(raw.directPath),
    jpegThumbnail: raw.jpegThumbnail,
    pageCount: readNumber(raw.pageCount),
  });
};

const extractInteractiveDetails = (content: UnknownRecord): {
  type: 'buttons_response' | 'list_response' | 'poll_choice' | null;
  payload: UnknownRecord | null;
  text: string | null;
} => {
  const buttonsResponse = asRecord(content.buttonsResponseMessage);
  if (buttonsResponse) {
    const text =
      readString(buttonsResponse.selectedDisplayText) ||
      readString(buttonsResponse.responseText) ||
      readString(buttonsResponse.title);
    return {
      type: 'buttons_response',
      payload: compactRecord({
        selectedButtonId: readString(buttonsResponse.selectedButtonId, buttonsResponse.selectedButtonIndex),
        selectedDisplayText: readString(buttonsResponse.selectedDisplayText),
        title: readString(buttonsResponse.title),
        responseMessageId: readString(buttonsResponse.responseMessageId),
      }),
      text,
    };
  }

  const listResponse = asRecord(content.listResponseMessage);
  const singleSelect = asRecord(listResponse?.singleSelectReply);
  if (listResponse && singleSelect) {
    const text =
      readString(singleSelect.selectedRowId) || readString(singleSelect.selectedDisplayText) || null;
    return {
      type: 'list_response',
      payload: compactRecord({
        listId: readString(listResponse.listId),
        title: readString(listResponse.title),
        description: readString(listResponse.description),
        singleSelectReply: compactRecord({
          selectedRowId: readString(singleSelect.selectedRowId),
          selectedDisplayText: readString(singleSelect.selectedDisplayText),
        }),
      }),
      text,
    };
  }

  const pollUpdate = asRecord(content.pollUpdateMessage);
  if (pollUpdate) {
    const vote = asRecord(pollUpdate.vote);
    return {
      type: 'poll_choice',
      payload: compactRecord({
        pollCreationMessageId: readString(pollUpdate.pollCreationMessageId),
        vote: vote
          ? compactRecord({
              values: Array.isArray(vote.values) ? vote.values : undefined,
            })
          : undefined,
      }),
      text: null,
    };
  }

  return { type: null, payload: null, text: null };
};

const determineMessageType = (content: UnknownRecord): string => {
  if (content.pollCreationMessage) {
    return 'poll';
  }
  if (content.pollUpdateMessage) {
    return 'poll_choice';
  }
  if (content.listResponseMessage) {
    return 'list_response';
  }
  if (content.buttonsResponseMessage) {
    return 'buttons_response';
  }
  if (content.imageMessage || content.stickerMessage) {
    return 'image';
  }
  if (content.videoMessage) {
    return 'video';
  }
  if (content.audioMessage) {
    return 'audio';
  }
  if (content.documentMessage) {
    return 'document';
  }
  return 'text';
};

const extractPrimaryText = (
  content: UnknownRecord,
  interactive: ReturnType<typeof extractInteractiveDetails>
): string | null => {
  const direct =
    readString(content.conversation) ||
    readString(asRecord(content.extendedTextMessage)?.text) ||
    readString(asRecord(content.templateButtonReplyMessage)?.selectedDisplayText) ||
    readString(asRecord(content.templateButtonReplyMessage)?.selectedId) ||
    readString(asRecord(content.buttonsMessage)?.contentText) ||
    null;

  if (direct) {
    return direct;
  }

  const mediaCaption =
    readString(asRecord(content.imageMessage)?.caption) ||
    readString(asRecord(content.videoMessage)?.caption) ||
    null;

  if (mediaCaption) {
    return mediaCaption;
  }

  if (interactive.text) {
    return interactive.text;
  }

  const pollName = readString(asRecord(content.pollCreationMessage)?.name);
  if (pollName) {
    return pollName;
  }

  return null;
};

const ensureMessageId = (message: UnknownRecord, key: UnknownRecord | null): string => {
  const candidate = readString(
    message.id,
    key?.id,
    asRecord(message.message)?.stanzaId,
    asRecord(message.message)?.stanzaID
  );
  if (candidate) {
    return candidate;
  }
  return `wamid-${randomUUID()}`;
};

const buildBaseMetadata = (params: {
  owner: string | null;
  source: string | null;
  messageType: string;
  messageIndex: number;
  messageTimestamp: number | null;
  remoteJid: string | null;
  participant: string | null;
  rawRemoteJid?: string | null;
  rawParticipant?: string | null;
  isGroup: boolean;
  tenantId?: string;
  sessionId?: string;
  brokerId?: string | null;
  instanceId?: string | null;
  direction: 'inbound' | 'outbound';
}): UnknownRecord => {
  return compactRecord({
    broker: compactRecord({
      type: 'baileys',
      direction: params.direction,
      owner: params.owner ?? undefined,
      source: params.source ?? 'raw_normalized',
      messageType: params.messageType,
      messageTimestamp: params.messageTimestamp ?? undefined,
      instanceId: params.instanceId ?? undefined,
      sessionId: params.sessionId ?? undefined,
      brokerId: params.brokerId ?? undefined,
      normalized: true,
      fromMe: params.direction === 'outbound',
    }),
    source: 'raw_normalized',
    direction: params.direction,
    rawKey:
      params.remoteJid ||
      params.participant ||
      params.rawRemoteJid ||
      params.rawParticipant
      ? compactRecord({
          remoteJid: params.remoteJid ?? undefined,
          participant: params.participant ?? undefined,
          jid: params.rawRemoteJid ?? undefined,
          participantJid: params.rawParticipant ?? undefined,
        })
      : undefined,
    contact: compactRecord({
      pushName: undefined,
      isGroup: params.isGroup,
      participant: params.participant ?? undefined,
      remoteJid: params.remoteJid ?? undefined,
    }),
    messageIndex: params.messageIndex,
    tenantId: params.tenantId,
    sessionId: params.sessionId,
  });
};

const buildContactDetails = (message: UnknownRecord, key: UnknownRecord | null) => {
  const remoteJid = readString(key?.remoteJid, message.remoteJid);
  const participant = readString(key?.participant, message.participant);
  const phone = normalizeRemoteJid(participant ?? remoteJid);
  const displayName =
    readString(message.pushName) ||
    readString((asRecord(message.message)?.contactMessage as UnknownRecord | undefined)?.displayName) ||
    remoteJid ||
    null;

  return {
    phone,
    name: displayName,
    pushName: readString(message.pushName),
    remoteJid,
    participant,
    isGroup: Boolean(remoteJid && remoteJid.endsWith('@g.us')),
  };
};

const normalizeMessagePayload = (
  message: UnknownRecord,
  messageIndex: number,
  context: {
    instanceId: string;
    owner: string | null;
    source: string | null;
    tenantId?: string;
    sessionId?: string;
    brokerId?: string | null;
    fallbackTimestamp: number | null;
  }
): { normalized: NormalizedRawUpsertMessage; contentType: string } | { ignore: IgnoredRawUpsertMessage } => {
  const key = asRecord(message.key);
  const fromMe = key?.fromMe === true;
  const direction: 'inbound' | 'outbound' = fromMe ? 'outbound' : 'inbound';

  if (fromMe) {
    return {
      ignore: {
        messageIndex,
        reason: 'from_me',
      },
    };
  }

  const rawContent = asRecord(message.message);
  const messageContent = unwrapMessageContent(rawContent);

  if (!messageContent) {
    return {
      ignore: {
        messageIndex,
        reason: 'empty_message',
      },
    };
  }

  if (messageContent.protocolMessage) {
    return {
      ignore: {
        messageIndex,
        reason: 'protocol_message',
      },
    };
  }

  if (messageContent.historySyncNotification) {
    return {
      ignore: {
        messageIndex,
        reason: 'history_sync',
      },
    };
  }

  if (message.messageStubType) {
    return {
      ignore: {
        messageIndex,
        reason: 'message_stub',
        details: {
          stubType: message.messageStubType,
        },
      },
    };
  }

  const contactDetails = buildContactDetails(message, key);
  const rawRemoteJid = contactDetails.remoteJid ?? null;
  const rawParticipant = contactDetails.participant ?? null;
  const remoteJid = rawRemoteJid ? normalizeRemoteJid(rawRemoteJid) : null;
  const participant = rawParticipant ? normalizeRemoteJid(rawParticipant) : null;
  const isGroup = contactDetails.isGroup;
  const messageTimestamp =
    readNumber(message.messageTimestamp, rawContent?.messageTimestamp) ?? context.fallbackTimestamp;
  const messageId = ensureMessageId(message, key);
  const interactive = extractInteractiveDetails(messageContent);
  const messageType = determineMessageType(messageContent);
  const quoted = extractQuotedDetails(messageContent);

  const normalizedMessage = compactRecord({
    id: messageId,
    type: messageType,
    conversation: readString(messageContent.conversation) ?? undefined,
    text: extractPrimaryText(messageContent, interactive) ?? undefined,
    key: compactRecord({
      id: readString(key?.id) ?? messageId,
      remoteJid: readString(key?.remoteJid),
      participant: readString(key?.participant),
      fromMe: fromMe || undefined,
    }),
    messageTimestamp,
    imageMessage: extractMediaDetails(messageContent, 'imageMessage') ??
      extractMediaDetails(messageContent, 'stickerMessage') ??
      undefined,
    videoMessage: extractMediaDetails(messageContent, 'videoMessage') ?? undefined,
    audioMessage: extractMediaDetails(messageContent, 'audioMessage') ?? undefined,
    documentMessage: extractMediaDetails(messageContent, 'documentMessage') ?? undefined,
    buttonsResponseMessage: interactive.type === 'buttons_response' ? interactive.payload ?? undefined : undefined,
    listResponseMessage: interactive.type === 'list_response' ? interactive.payload ?? undefined : undefined,
    pollUpdateMessage: interactive.type === 'poll_choice' ? interactive.payload ?? undefined : undefined,
    pollCreationMessage: asRecord(messageContent.pollCreationMessage)
      ? compactRecord({
          name: readString(asRecord(messageContent.pollCreationMessage)?.name),
          options: Array.isArray(asRecord(messageContent.pollCreationMessage)?.options)
            ? asRecord(messageContent.pollCreationMessage)?.options
            : undefined,
          selectableOptionsCount: readNumber(
            asRecord(messageContent.pollCreationMessage)?.selectableOptionsCount
          ),
        })
      : undefined,
    caption:
      readString(asRecord(messageContent.imageMessage)?.caption) ??
      readString(asRecord(messageContent.videoMessage)?.caption) ??
      undefined,
    quotedMessageId: quoted ? readString(quoted.quotedMessageId) ?? undefined : undefined,
    quotedText: quoted ? readString(quoted.quotedText) ?? undefined : undefined,
    quotedParticipant: quoted ? readString(quoted.quotedParticipant) ?? undefined : undefined,
  });

  const mediaPriority = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage'] as const;
  const matchedMedia = mediaPriority.find((candidate) => normalizedMessage[candidate]);

  const normalizeMediaType = (candidate: (typeof mediaPriority)[number]): string => {
    if (candidate === 'imageMessage') {
      return 'image';
    }
    if (candidate === 'videoMessage') {
      return 'video';
    }
    if (candidate === 'audioMessage') {
      return 'audio';
    }
    return 'document';
  };

  if (matchedMedia) {
    const mediaRecord = asRecord(normalizedMessage[matchedMedia]);
    const mediaType = normalizeMediaType(matchedMedia);
    const caption = readString(mediaRecord?.caption) ?? normalizedMessage.caption ?? null;
    normalizedMessage.type = 'media';
    normalizedMessage.text = caption ?? null;
    normalizedMessage.media = compactRecord({
      mediaType,
      caption: caption ?? undefined,
      mimetype: readString(mediaRecord?.mimetype) ?? undefined,
      fileName: readString(mediaRecord?.fileName) ?? undefined,
      fileLength: readNumber(mediaRecord?.fileLength ?? (mediaRecord as { fileLength?: unknown })?.fileLength),
    });
  } else {
    const hasText =
      readString(messageContent.conversation) ||
      readString(asRecord(messageContent.extendedTextMessage)?.text) ||
      readString(normalizedMessage.text);

    if (hasText) {
      normalizedMessage.type = 'text';
      normalizedMessage.text = hasText;
    } else {
      normalizedMessage.type = 'unknown';
      normalizedMessage.text = null;
    }
  }

  const metadata = buildBaseMetadata({
    owner: context.owner,
    source: context.source,
    messageType,
    messageIndex,
    messageTimestamp,
    remoteJid,
    participant,
    rawRemoteJid,
    rawParticipant,
    isGroup,
    ...(context.tenantId !== undefined ? { tenantId: context.tenantId } : {}),
    ...(context.sessionId !== undefined ? { sessionId: context.sessionId } : {}),
    ...(context.brokerId !== undefined ? { brokerId: context.brokerId ?? null } : {}),
    instanceId: context.instanceId,
    direction,
  });

  metadata.contact = compactRecord({
    pushName: contactDetails.pushName ?? undefined,
    isGroup,
    participant,
    remoteJid,
    jid: rawRemoteJid ?? undefined,
    participantJid: rawParticipant ?? undefined,
    registrations: null,
  }) as BrokerInboundContact;

  if (quoted) {
    metadata.quoted = quoted;
  }

  if (interactive.type) {
    metadata.interactive = {
      type: interactive.type,
    };
  }

  if (messageContent.senderKeyDistributionMessage) {
    metadata.skd = true;
  }

  const fromContact = compactRecord({
    phone: contactDetails.phone ?? undefined,
    name: contactDetails.name ?? undefined,
    pushName: contactDetails.pushName ?? undefined,
    registrations: null,
  }) as BrokerInboundContact;

  const normalized: BrokerWebhookInbound = {
    direction,
    instanceId: context.instanceId,
    timestamp: toIsoTimestamp(messageTimestamp),
    from: fromContact,
    message: normalizedMessage,
    metadata,
  };

  return {
    normalized: {
      data: normalized,
      messageIndex,
      ...(context.tenantId !== undefined ? { tenantId: context.tenantId } : {}),
      ...(context.sessionId !== undefined ? { sessionId: context.sessionId } : {}),
      ...(context.brokerId !== undefined ? { brokerId: context.brokerId } : {}),
      messageId,
      messageType,
      isGroup,
    },
    contentType: messageType,
  };
};

export const normalizeUpsertEvent = (
  rawEvent: RawBaileysUpsertEvent | null | undefined,
  overrides?: NormalizeUpsertOverrides
): NormalizeUpsertResult => {
  const eventRecord = asRecord(rawEvent);
  if (!eventRecord) {
    return { normalized: [], ignored: [] };
  }

  const payload = asRecord(eventRecord.payload) ?? {};
  const rawEnvelope = asRecord(payload.raw);
  const rawPayload = asRecord(rawEnvelope?.payload) ?? rawEnvelope;
  const rawMetadata = rawPayload ? asRecord(rawPayload.metadata) : null;

  const eventType = readString(eventRecord.event);
  if (eventType && eventType !== 'WHATSAPP_MESSAGES_UPSERT') {
    return { normalized: [], ignored: [] };
  }

  const metadataRecord = asRecord(payload.metadata);
  const brokerMetadata = metadataRecord ? asRecord(metadataRecord.broker) : null;

  const resolvedInstanceId =
    readString(
      overrides?.instanceId,
      payload.instanceId,
      eventRecord.instanceId,
      metadataRecord?.instanceId,
      metadataRecord?.instance_id,
      brokerMetadata?.instanceId
    ) ?? null;
  if (!resolvedInstanceId) {
    return { normalized: [], ignored: [] };
  }

  const tenantId =
    readString(
      overrides?.tenantId,
      payload.tenantId,
      eventRecord.tenantId,
      rawPayload?.tenantId,
      rawMetadata?.tenantId
    ) ?? undefined;
  const brokerId =
    readString(
      overrides?.brokerId,
      payload.brokerId,
      eventRecord.brokerId,
      eventRecord.iid,
      payload.iid,
      rawPayload?.brokerId,
      rawMetadata?.brokerId
    ) ?? undefined;
  const sessionId =
    readString(
      overrides?.sessionId,
      payload.sessionId,
      eventRecord.sessionId,
      rawPayload?.sessionId,
      rawEnvelope?.sessionId,
      rawMetadata?.sessionId
    ) ?? brokerId ?? undefined;
  const owner =
    readString(
      payload.owner,
      eventRecord.owner,
      rawPayload?.owner,
      rawEnvelope?.owner,
      rawMetadata?.owner
    ) ?? null;
  const source =
    readString(
      payload.source,
      eventRecord.source,
      rawPayload?.source,
      rawEnvelope?.source,
      rawMetadata?.source
    ) ?? null;
  const fallbackTimestamp =
    readNumber(
      payload.timestamp,
      eventRecord.timestamp,
      rawPayload?.timestamp,
      rawEnvelope?.timestamp,
      rawMetadata?.timestamp
    ) ?? null;

  const primaryMessages = asArray(payload.messages);
  const rawMessages = asArray(rawPayload?.messages ?? rawEnvelope?.messages);
  const messages = primaryMessages.length > 0 ? primaryMessages : rawMessages;

  logger.info('🎬 WhatsApp raw normalizer subiu ao palco', {
    instanceId: resolvedInstanceId,
    providedMessages: primaryMessages.length,
    fallbackMessages: rawMessages.length,
  });

  if (primaryMessages.length === 0 && rawMessages.length > 0) {
    logger.info('🪄 Mensagens pescadas direto do envelope raw', {
      instanceId: resolvedInstanceId,
      total: rawMessages.length,
    });
  }

  const normalized: NormalizedRawUpsertMessage[] = [];
  const ignored: IgnoredRawUpsertMessage[] = [];

  messages.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      logger.info('🙈 Mensagem raw ignorada por estar fora do formato esperado', {
        instanceId: resolvedInstanceId,
        messageIndex: index,
      });
      ignored.push({
        messageIndex: index,
        reason: 'invalid_entry',
      });
      return;
    }

    const normalizedMessage = normalizeMessagePayload(entry as UnknownRecord, index, {
      instanceId: resolvedInstanceId,
      owner,
      source,
      ...(tenantId ? { tenantId } : {}),
      ...(sessionId ? { sessionId } : {}),
      brokerId: brokerId ?? null,
      fallbackTimestamp,
    });

    if ('ignore' in normalizedMessage) {
      logger.info('🙈 Mensagem raw saiu do palco', {
        instanceId: resolvedInstanceId,
        messageIndex: index,
        reason: normalizedMessage.ignore.reason,
      });
      ignored.push(normalizedMessage.ignore);
      return;
    }

    logger.info('💌 Mensagem raw ganhou os holofotes', {
      instanceId: resolvedInstanceId,
      messageIndex: index,
      messageType: normalizedMessage.normalized.messageType,
    });
    normalized.push(normalizedMessage.normalized);
  });

  return { normalized, ignored };
};

export const __testing = {
  asRecord,
  unwrapMessageContent,
  extractInteractiveDetails,
  extractQuotedDetails,
  determineMessageType,
  extractPrimaryText,
  normalizeRemoteJid,
};
