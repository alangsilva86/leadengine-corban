import type { NormalizedMessageType } from '../../utils/normalize';

export const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};

export const asRecord = toRecord;

export const derivePayloadSegments = (
  payload: unknown
): {
  payload: Record<string, unknown>;
  message: Record<string, unknown>;
  metadata: Record<string, unknown>;
} => {
  const payloadRecord = toRecord(payload);
  const nestedMessage = toRecord((payloadRecord as any).message);
  const nestedMetadata = toRecord((payloadRecord as any).metadata);

  const hasNestedMessage = Object.keys(nestedMessage).length > 0;
  const messageRecord = hasNestedMessage ? nestedMessage : payloadRecord;

  const metadataCandidates = [
    nestedMetadata,
    toRecord((messageRecord as any).metadata),
  ];

  let metadataRecord: Record<string, unknown> = {};
  for (const candidate of metadataCandidates) {
    if (candidate && Object.keys(candidate).length > 0) {
      metadataRecord = candidate;
      break;
    }
  }

  return {
    payload: payloadRecord,
    message: messageRecord,
    metadata: metadataRecord,
  };
};

export const isHttpUrl = (value: string | null | undefined): boolean =>
  typeof value === 'string' && /^https?:\/\//i.test(value.trim());

export const readNullableString = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
};

export const readNullableNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export const MEDIA_MESSAGE_TYPES = new Set<NormalizedMessageType>([
  'IMAGE',
  'VIDEO',
  'AUDIO',
  'DOCUMENT',
]);

export const RAW_MEDIA_MESSAGE_KEYS = [
  'imageMessage',
  'videoMessage',
  'audioMessage',
  'documentMessage',
  'stickerMessage',
] as const;
