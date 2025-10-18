export interface InboundContactDetails {
  phone?: string | null;
  name?: string | null;
  document?: string | null;
  registrations?: string[] | null;
  avatarUrl?: string | null;
  pushName?: string | null;
}

export interface InboundMessageDetails {
  id?: string | null;
  type?: string | null;
  text?: unknown;
  metadata?: Record<string, unknown> | null;
  conversation?: unknown;
  extendedTextMessage?: unknown;
  imageMessage?: unknown;
  videoMessage?: unknown;
  audioMessage?: unknown;
  documentMessage?: unknown;
  contactsArrayMessage?: unknown;
  locationMessage?: unknown;
  templateButtonReplyMessage?: unknown;
  buttonsResponseMessage?: unknown;
  stickerMessage?: unknown;
  key?: {
    id?: string | null;
    remoteJid?: string | null;
  } | null;
  messageTimestamp?: number | null;
}

export interface InboundWhatsAppEvent {
  id: string;
  instanceId: string;
  direction: 'INBOUND' | 'OUTBOUND';
  chatId: string | null;
  externalId?: string | null;
  timestamp: string | null;
  contact: InboundContactDetails;
  message: InboundMessageDetails;
  metadata?: Record<string, unknown> | null;
  tenantId?: string | null;
  sessionId?: string | null;
}

export interface InboundWhatsAppEnvelopeBase {
  origin: string;
  instanceId: string;
  chatId: string | null;
  tenantId: string | null;
  dedupeTtlMs?: number;
  raw?: Record<string, unknown> | null;
}

export interface InboundWhatsAppEnvelopeMessage extends InboundWhatsAppEnvelopeBase {
  message: {
    kind: 'message';
    id: string | null;
    externalId?: string | null;
    brokerMessageId?: string | null;
    timestamp: string | null;
    direction: 'INBOUND' | 'OUTBOUND';
    contact: InboundContactDetails;
    payload: InboundMessageDetails;
    metadata?: Record<string, unknown> | null;
  };
}

export interface InboundWhatsAppEnvelopeUpdate extends InboundWhatsAppEnvelopeBase {
  message: {
    kind: 'update';
    id: string;
    status?: string | null;
    timestamp?: string | null;
    metadata?: Record<string, unknown> | null;
  };
}

export type InboundWhatsAppEnvelope = InboundWhatsAppEnvelopeMessage | InboundWhatsAppEnvelopeUpdate;

export const isMessageEnvelope = (
  envelope: InboundWhatsAppEnvelope
): envelope is InboundWhatsAppEnvelopeMessage => envelope.message.kind === 'message';
