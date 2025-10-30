import { readString } from '../identifiers';
import {
  derivePayloadSegments,
  toRecord,
} from './helpers';
import type {
  InboundWhatsAppEnvelope,
  InboundWhatsAppEnvelopeMessage,
} from '../types';

export const resolveEnvelopeChatId = (envelope: InboundWhatsAppEnvelopeMessage): string | null => {
  const provided = readString(envelope.chatId);
  if (provided) return provided;

  const { payload: payloadRecord, message: payloadMessage, metadata: payloadMetadata } = derivePayloadSegments(
    envelope.message.payload
  );

  const metadataChatId =
    readString((payloadMetadata as any).chatId) ?? readString((payloadRecord as any).chatId);
  if (metadataChatId) return metadataChatId;

  const metadataRemoteJid =
    readString((payloadMetadata as any).remoteJid) ?? readString((payloadRecord as any).remoteJid);
  if (metadataRemoteJid) return metadataRemoteJid;

  const contactRecord = toRecord(
    (payloadMetadata as any).contact ?? (payloadRecord as any).contact ?? (payloadMessage as any).contact
  );
  const contactChatId =
    readString((contactRecord as any).chatId) ??
    readString((contactRecord as any).remoteJid) ??
    readString((contactRecord as any).jid);
  if (contactChatId) return contactChatId;

  const keyRecord = toRecord((payloadMessage as any).key);
  return readString((keyRecord as any).remoteJid) ?? readString((keyRecord as any).jid) ?? null;
};

export const resolveEnvelopeMessageId = (envelope: InboundWhatsAppEnvelopeMessage): string | null => {
  const { payload: payloadRecord, message: payloadMessage } = derivePayloadSegments(envelope.message.payload);
  const keyRecord = toRecord((payloadMessage as any).key);

  return (
    readString(envelope.message.externalId) ??
    readString(envelope.message.brokerMessageId) ??
    readString(envelope.message.id) ??
    readString((payloadMessage as any).id) ??
    readString((payloadRecord as any).id) ??
    readString((keyRecord as any).id)
  );
};

export const mergeEnvelopeMetadata = (
  envelope: InboundWhatsAppEnvelopeMessage,
  chatId: string | null,
  overrides?: {
    payload?: Record<string, unknown>;
    message?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }
): Record<string, unknown> => {
  const base = toRecord(envelope.message.metadata);
  const payloadRecord = overrides?.payload ? toRecord(overrides.payload) : toRecord(envelope.message.payload);
  const { message: derivedMessage, metadata: derivedMetadata } = derivePayloadSegments(
    overrides?.payload ?? envelope.message.payload
  );
  const payloadMessage = overrides?.message ? toRecord(overrides.message) : derivedMessage;
  const payloadMetadata = overrides?.metadata ? toRecord(overrides.metadata) : derivedMetadata;

  if (!(base as any).chatId && chatId) (base as any).chatId = chatId;

  if (!(base as any).tenantId) {
    const payloadTenantId =
      readString((payloadMetadata as any).tenantId) ?? readString((payloadRecord as any).tenantId);
    if (payloadTenantId) (base as any).tenantId = payloadTenantId;
    else if (envelope.tenantId) (base as any).tenantId = envelope.tenantId;
  }

  if (!(base as any).tenant) {
    const payloadTenant = toRecord(
      (payloadMetadata as any).tenant ?? (payloadRecord as any).tenant ?? (payloadMessage as any).tenant
    );
    if (Object.keys(payloadTenant).length > 0) (base as any).tenant = payloadTenant;
  }

  if (!(base as any).context) {
    const payloadContext = toRecord(
      (payloadMetadata as any).context ?? (payloadRecord as any).context ?? (payloadMessage as any).context
    );
    if (Object.keys(payloadContext).length > 0) (base as any).context = payloadContext;
  }

  if (!(base as any).integration) {
    const payloadIntegration = toRecord(
      (payloadMetadata as any).integration ?? (payloadRecord as any).integration ?? (payloadMessage as any).integration
    );
    if (Object.keys(payloadIntegration).length > 0) (base as any).integration = payloadIntegration;
  }

  if (!(base as any).sessionId) {
    const payloadSessionId =
      readString((payloadMetadata as any).sessionId) ??
      readString((payloadRecord as any).sessionId) ??
      readString((payloadMessage as any).sessionId);
    if (payloadSessionId) (base as any).sessionId = payloadSessionId;
  }

  const metadataSourceCandidates = [
    payloadMetadata,
    payloadMessage,
    payloadRecord,
  ];

  for (const source of metadataSourceCandidates) {
    if ((base as any).instanceId) break;
    const candidate = readString((source as any)?.instanceId);
    if (candidate) (base as any).instanceId = candidate;
  }

  if (!(base as any).source) {
    const payloadSource = toRecord(
      (payloadMetadata as any).source ?? (payloadRecord as any).source ?? (payloadMessage as any).source
    );
    if (Object.keys(payloadSource).length > 0) (base as any).source = payloadSource;
  }

  if (!(base as any).origin) {
    const candidates = [
      readString((payloadMetadata as any).origin),
      readString((payloadRecord as any).origin),
      readString((payloadMessage as any).origin),
      readString(envelope.origin),
    ];
    for (const candidate of candidates) {
      if (candidate) {
        (base as any).origin = candidate;
        break;
      }
    }
  }

  return base;
};

export const resolveChatId = (envelope: InboundWhatsAppEnvelope): string | null => {
  const { payload: payloadRecord, message, metadata } = derivePayloadSegments((envelope as any)?.message?.payload);
  const key = toRecord((message as any).key);
  const contactRecord = toRecord(
    (metadata as any).contact ?? (payloadRecord as any).contact ?? (message as any).contact
  );

  return (
    readString((metadata as any).chatId) ??
    readString((payloadRecord as any).chatId) ??
    readString((metadata as any).remoteJid) ??
    readString((payloadRecord as any).remoteJid) ??
    readString((contactRecord as any).remoteJid) ??
    readString((contactRecord as any).jid) ??
    readString((key as any).remoteJid) ??
    readString((envelope as any).chatId) ??
    null
  );
};

export const resolveMessageId = (envelope: InboundWhatsAppEnvelope): string | null => {
  const { payload: payloadRecord, message } = derivePayloadSegments((envelope as any)?.message?.payload);
  return (
    readString((message as any).id) ??
    readString((payloadRecord as any).id) ??
    readString((envelope as any)?.message?.id) ??
    null
  );
};
