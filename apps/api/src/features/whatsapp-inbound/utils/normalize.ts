import { randomUUID } from 'node:crypto';

export type NormalizedMessageType =
  | 'TEXT'
  | 'IMAGE'
  | 'VIDEO'
  | 'AUDIO'
  | 'DOCUMENT'
  | 'LOCATION'
  | 'CONTACT'
  | 'TEMPLATE';

export interface NormalizedInboundMessage {
  id: string;
  clientMessageId: string | null;
  conversationId: string | null;
  type: NormalizedMessageType;
  text: string;
  caption?: string | null;
  mediaUrl?: string | null;
  mimetype?: string | null;
  fileSize?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  locationName?: string | null;
  contacts?: Array<{ name?: string | null; phone?: string | null }> | null;
  buttonPayload?: string | null;
  templatePayload?: unknown;
  raw: Record<string, unknown>;
  brokerMessageTimestamp: number | null;
  receivedAt: number;
}

interface RawInboundMessage {
  id?: string | null;
  key?: {
    id?: string | null;
    remoteJid?: string | null;
  } | null;
  type?: string | null;
  text?: unknown;
  conversation?: unknown;
  extendedTextMessage?: unknown;
  imageMessage?: unknown;
  videoMessage?: unknown;
  audioMessage?: unknown;
  documentMessage?: unknown;
  stickerMessage?: unknown;
  contactsArrayMessage?: unknown;
  locationMessage?: unknown;
  templateButtonReplyMessage?: unknown;
  buttonsResponseMessage?: unknown;
  metadata?: Record<string, unknown> | null;
  messageTimestamp?: number | null;
}

const allowedTypes = new Set<NormalizedMessageType>([
  'TEXT',
  'IMAGE',
  'VIDEO',
  'AUDIO',
  'DOCUMENT',
  'LOCATION',
  'CONTACT',
  'TEMPLATE',
]);

const safeString = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
};

const extractText = (value: unknown): string | null => {
  if (!value) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const extracted = extractText(entry);
      if (extracted) return extracted;
    }
    return null;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const candidateKeys = [
      'text',
      'body',
      'caption',
      'message',
      'conversation',
      'content',
      'value',
      'description',
      'title',
    ];
    for (const key of candidateKeys) {
      if (key in record) {
        const extracted = extractText(record[key]);
        if (extracted) return extracted;
      }
    }
  }
  return null;
};

const extractMediaUrl = (value: unknown): string | null => {
  if (!value) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const extracted = extractMediaUrl(entry);
      if (extracted) return extracted;
    }
    return null;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const candidateKeys = ['url', 'mediaUrl', 'directPath', 'downloadUrl'];
    for (const key of candidateKeys) {
      const extracted = extractMediaUrl(record[key]);
      if (extracted) return extracted;
    }
  }
  return null;
};

const extractFileSize = (value: unknown): number | null => {
  if (!value) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const candidateKeys = ['fileLength', 'size'];
    for (const key of candidateKeys) {
      const extracted = extractFileSize(record[key]);
      if (extracted !== null) return extracted;
    }
  }
  return null;
};

const extractLocation = (value: unknown): { latitude: number | null; longitude: number | null; name: string | null } | null => {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const lat = typeof record.degreesLatitude === 'number' ? record.degreesLatitude : null;
  const lng = typeof record.degreesLongitude === 'number' ? record.degreesLongitude : null;
  const name = safeString(record.name) ?? safeString(record.address);
  if (lat === null && lng === null && !name) return null;
  return { latitude: lat, longitude: lng, name: name ?? null };
};

const extractContacts = (value: unknown): Array<{ name?: string | null; phone?: string | null }> | null => {
  if (!Array.isArray(value)) return null;
  const contacts = value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const record = entry as Record<string, unknown>;
      const nameRecord = record.displayName ?? record.vcard?.name ?? record.contact?.name;
      const phoneRecord = record.vcard?.phoneNumber ?? record.contact?.phoneNumber ?? record.phoneNumber;
      const name = safeString(nameRecord);
      const phone = safeString(phoneRecord);
      if (!name && !phone) return null;
      return { name: name ?? null, phone: phone ?? null };
    })
    .filter(Boolean) as Array<{ name?: string | null; phone?: string | null }>;
  return contacts.length > 0 ? contacts : null;
};

const determineType = (message: RawInboundMessage, fallback: NormalizedMessageType): NormalizedMessageType => {
  const rawType = message.type?.trim().toUpperCase();
  if (rawType && allowedTypes.has(rawType as NormalizedMessageType)) {
    return rawType as NormalizedMessageType;
  }
  if (message.imageMessage) return 'IMAGE';
  if (message.videoMessage) return 'VIDEO';
  if (message.audioMessage) return 'AUDIO';
  if (message.documentMessage) return 'DOCUMENT';
  if (message.stickerMessage) return 'IMAGE';
  if (message.contactsArrayMessage) return 'CONTACT';
  if (message.locationMessage) return 'LOCATION';
  if (message.templateButtonReplyMessage || message.buttonsResponseMessage) return 'TEMPLATE';
  return fallback;
};

const normalizeId = (message: RawInboundMessage): string => {
  const rawId = message.id || message.key?.id;
  return rawId && rawId.trim().length > 0 ? rawId : `wamid-${randomUUID()}`;
};

export const normalizeInboundMessage = (message: RawInboundMessage): NormalizedInboundMessage => {
  const id = normalizeId(message);
  const type = determineType(message, 'TEXT');

  const baseText =
    extractText(message.text) ||
    extractText(message.conversation) ||
    extractText(message.extendedTextMessage) ||
    extractText(message.templateButtonReplyMessage) ||
    extractText(message.buttonsResponseMessage) ||
    extractText(message.metadata) ||
    '[Mensagem recebida via WhatsApp]';

  const caption =
    extractText(message.imageMessage) ||
    extractText(message.videoMessage) ||
    extractText(message.audioMessage) ||
    extractText(message.documentMessage) ||
    null;

  const mediaUrl =
    extractMediaUrl(message.metadata) ||
    extractMediaUrl(message.imageMessage) ||
    extractMediaUrl(message.videoMessage) ||
    extractMediaUrl(message.audioMessage) ||
    extractMediaUrl(message.documentMessage) ||
    extractMediaUrl(message.stickerMessage) ||
    null;

  const mimetype =
    safeString((message.imageMessage as Record<string, unknown>)?.mimetype) ||
    safeString((message.videoMessage as Record<string, unknown>)?.mimetype) ||
    safeString((message.audioMessage as Record<string, unknown>)?.mimetype) ||
    safeString((message.documentMessage as Record<string, unknown>)?.mimetype) ||
    safeString((message.stickerMessage as Record<string, unknown>)?.mimetype) ||
    null;

  const fileSize =
    extractFileSize(message.imageMessage) ||
    extractFileSize(message.videoMessage) ||
    extractFileSize(message.audioMessage) ||
    extractFileSize(message.documentMessage) ||
    extractFileSize(message.stickerMessage) ||
    null;

  const location = extractLocation(message.locationMessage);
  const contacts = extractContacts((message.contactsArrayMessage as unknown[] | undefined) ?? null);

  const buttonPayload =
    safeString((message.buttonsResponseMessage as Record<string, unknown>)?.selectedButtonId) ||
    safeString((message.templateButtonReplyMessage as Record<string, unknown>)?.selectedId) ||
    null;

  const templatePayload =
    message.templateButtonReplyMessage ||
    (typeof message.buttonsResponseMessage === 'object' ? message.buttonsResponseMessage : null);

  const timestamp =
    typeof message.messageTimestamp === 'number'
      ? message.messageTimestamp
      : typeof message.metadata?.timestamp === 'number'
        ? message.metadata?.timestamp
        : null;

  return {
    id,
    clientMessageId: safeString(message.key?.id),
    conversationId: safeString(message.key?.remoteJid),
    type,
    text: baseText,
    caption,
    mediaUrl,
    mimetype,
    fileSize,
    latitude: location?.latitude ?? null,
    longitude: location?.longitude ?? null,
    locationName: location?.name ?? null,
    contacts,
    buttonPayload,
    templatePayload,
    raw: message as Record<string, unknown>,
    brokerMessageTimestamp: timestamp,
    receivedAt: Date.now(),
  };
};
