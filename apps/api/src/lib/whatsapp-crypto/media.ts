import { Buffer } from 'node:buffer';
import { createDecipheriv, createHash, createHmac, hkdfSync, timingSafeEqual } from 'node:crypto';

import { toBuffer, tryToBuffer } from './bytes';
import { WhatsAppCryptoError } from './errors';

/**
 * HKDF `info` label per media type: `WhatsApp ${label} Keys`.
 * Mirrors the WhatsApp Web / Baileys mapping (`MEDIA_HKDF_KEY_MAPPING`). Types with an empty
 * label (`ppic`, `product-catalog-image`) intentionally produce `"WhatsApp  Keys"` (two spaces).
 */
export const MEDIA_HKDF_KEY_MAPPING = {
  audio: 'Audio',
  document: 'Document',
  gif: 'Video',
  image: 'Image',
  ppic: '',
  product: 'Image',
  ptt: 'Audio',
  sticker: 'Image',
  video: 'Video',
  'thumbnail-document': 'Document Thumbnail',
  'thumbnail-image': 'Image Thumbnail',
  'thumbnail-video': 'Video Thumbnail',
  'thumbnail-link': 'Link Thumbnail',
  'md-msg-hist': 'History',
  'md-app-state': 'App State',
  'product-catalog-image': '',
  'payment-bg-image': 'Payment Background',
  ptv: 'Video',
} as const;

export type WhatsAppMediaType = keyof typeof MEDIA_HKDF_KEY_MAPPING;

export const WHATSAPP_MEDIA_TYPES = Object.keys(MEDIA_HKDF_KEY_MAPPING) as WhatsAppMediaType[];

export const isWhatsAppMediaType = (value: unknown): value is WhatsAppMediaType =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(MEDIA_HKDF_KEY_MAPPING, value);

export interface WhatsAppMediaKeys {
  /** AES-256-CBC IV (16 bytes). */
  iv: Buffer;
  /** AES-256-CBC key (32 bytes). */
  cipherKey: Buffer;
  /** HMAC-SHA256 key (32 bytes). */
  macKey: Buffer;
}

export const MEDIA_KEY_LENGTH = 32;
export const MEDIA_MAC_LENGTH = 10;
const AES_BLOCK_SIZE = 16;
const SHA256_LENGTH = 32;
const EXPANDED_KEY_LENGTH = 112;
/** RFC 5869: an absent salt is HashLen zero bytes (this is what futoin-hkdf/Baileys use). */
const HKDF_ZERO_SALT = Buffer.alloc(32, 0);

export const mediaHkdfInfo = (mediaType: WhatsAppMediaType): string =>
  `WhatsApp ${MEDIA_HKDF_KEY_MAPPING[mediaType]} Keys`;

const assertMediaType: (mediaType: unknown) => asserts mediaType is WhatsAppMediaType = (mediaType) => {
  if (!isWhatsAppMediaType(mediaType)) {
    throw new WhatsAppCryptoError('INVALID_INPUT', 'Unsupported WhatsApp media type', {
      details: { mediaType: typeof mediaType === 'string' ? mediaType.slice(0, 64) : typeof mediaType },
    });
  }
};

/**
 * Expands the 32-byte `mediaKey` of a message into the AES/HMAC keys used for that media type:
 * HKDF-SHA256(ikm = mediaKey, salt = 32 zero bytes, info = `WhatsApp <Type> Keys`, L = 112)
 * → iv = [0,16), cipherKey = [16,48), macKey = [48,80) (the remaining 32 bytes are unused).
 */
export const deriveMediaKeys = (mediaKey: unknown, mediaType: WhatsAppMediaType): WhatsAppMediaKeys => {
  assertMediaType(mediaType);
  const ikm = toBuffer(mediaKey, 'mediaKey', { length: MEDIA_KEY_LENGTH });
  const expanded = Buffer.from(
    hkdfSync('sha256', ikm, HKDF_ZERO_SALT, mediaHkdfInfo(mediaType), EXPANDED_KEY_LENGTH)
  );
  return {
    iv: expanded.subarray(0, 16),
    cipherKey: expanded.subarray(16, 48),
    macKey: expanded.subarray(48, 80),
  };
};

export interface DecryptMediaOptions {
  /** SHA-256 of the encrypted blob (`ciphertext ‖ mac`), from the message. Verified when provided. */
  fileEncSha256?: unknown;
  /** SHA-256 of the plaintext, from the message. Verified when provided. */
  fileSha256?: unknown;
}

const sha256 = (data: Uint8Array): Buffer => createHash('sha256').update(data).digest();

const assertDigest = (expectedRaw: unknown, actual: Buffer, field: string): void => {
  if (expectedRaw === undefined || expectedRaw === null) {
    return;
  }
  const expected = toBuffer(expectedRaw, field, { length: SHA256_LENGTH });
  if (!timingSafeEqual(expected, actual)) {
    throw new WhatsAppCryptoError('HASH_MISMATCH', `${field} does not match the media content`, {
      details: { field },
    });
  }
};

/**
 * Decrypts a downloaded WhatsApp media blob (`AES-256-CBC(ciphertext) ‖ HMAC-SHA256(macKey, iv ‖ ciphertext)[0,10)`).
 *
 * Order of checks: structure → `fileEncSha256` (optional) → MAC (constant-time) → AES-CBC/PKCS#7
 * → `fileSha256` (optional). Nothing is decrypted before the MAC is verified.
 */
export const decryptMediaBuffer = (
  encrypted: Uint8Array,
  keys: WhatsAppMediaKeys,
  options: DecryptMediaOptions = {}
): Buffer => {
  const blob = toBuffer(encrypted, 'encryptedMedia');
  const iv = toBuffer(keys.iv, 'iv', { length: AES_BLOCK_SIZE });
  const cipherKey = toBuffer(keys.cipherKey, 'cipherKey', { length: 32 });
  const macKey = toBuffer(keys.macKey, 'macKey', { length: 32 });

  const ciphertextLength = blob.length - MEDIA_MAC_LENGTH;
  if (ciphertextLength < AES_BLOCK_SIZE || ciphertextLength % AES_BLOCK_SIZE !== 0) {
    throw new WhatsAppCryptoError('INVALID_INPUT', 'Encrypted media is truncated or malformed', {
      details: { length: blob.length },
    });
  }

  assertDigest(options.fileEncSha256, sha256(blob), 'fileEncSha256');

  const ciphertext = blob.subarray(0, ciphertextLength);
  const receivedMac = blob.subarray(ciphertextLength);
  const expectedMac = createHmac('sha256', macKey).update(iv).update(ciphertext).digest().subarray(0, MEDIA_MAC_LENGTH);
  if (!timingSafeEqual(receivedMac, expectedMac)) {
    throw new WhatsAppCryptoError('INVALID_MAC', 'Media MAC verification failed', {
      details: { length: blob.length },
    });
  }

  let plaintext: Buffer;
  try {
    const decipher = createDecipheriv('aes-256-cbc', cipherKey, iv);
    plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch (error) {
    throw new WhatsAppCryptoError('DECRYPT_FAILED', 'Media AES-CBC decryption failed', { cause: error });
  }

  assertDigest(options.fileSha256, sha256(plaintext), 'fileSha256');
  return plaintext;
};

export interface DownloadableMedia {
  mediaKey?: unknown;
  directPath?: string | null;
  url?: string | null;
  fileEncSha256?: unknown;
  fileSha256?: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** Wrappers that only carry another message (ephemeral, view once, edited, documentWithCaption…). */
const FUTURE_PROOF_WRAPPERS = [
  'ephemeralMessage',
  'viewOnceMessage',
  'documentWithCaptionMessage',
  'viewOnceMessageV2',
  'viewOnceMessageV2Extension',
  'editedMessage',
] as const;

const unwrapMessageContent = (content: Record<string, unknown>): Record<string, unknown> => {
  let current = content;
  for (let depth = 0; depth < 5; depth += 1) {
    const wrapper = FUTURE_PROOF_WRAPPERS.map((key) => current[key]).find(isRecord);
    const inner = wrapper && isRecord(wrapper.message) ? wrapper.message : null;
    if (!inner) {
      break;
    }
    current = inner;
  }
  return current;
};

const TEMPLATE_MEDIA_KEYS = ['imageMessage', 'documentMessage', 'videoMessage'] as const;

const extractTemplateMedia = (template: Record<string, unknown>): Record<string, unknown> | null => {
  for (const key of TEMPLATE_MEDIA_KEYS) {
    if (isRecord(template[key])) {
      return { [key]: template[key] };
    }
  }
  return null;
};

const extractMessageContent = (content: Record<string, unknown>): Record<string, unknown> => {
  const normalized = unwrapMessageContent(content);
  if (isRecord(normalized.buttonsMessage)) {
    return extractTemplateMedia(normalized.buttonsMessage) ?? {};
  }
  const template = isRecord(normalized.templateMessage) ? normalized.templateMessage : null;
  if (template) {
    for (const key of ['hydratedFourRowTemplate', 'hydratedTemplate', 'fourRowTemplate'] as const) {
      if (isRecord(template[key])) {
        return extractTemplateMedia(template[key]) ?? {};
      }
    }
  }
  return normalized;
};

/**
 * Finds the downloadable media inside a WhatsApp `WAMessage`-shaped object (`{ key, message }`),
 * following the same rules as WhatsApp Web/Baileys `downloadMediaMessage`:
 * unwraps ephemeral/view-once/edited/documentWithCaption wrappers and button/template messages,
 * takes the first `*Message` content key, maps `<type>Message` → `<type>` media type and falls back
 * to `thumbnail-link` for link previews that only carry a `thumbnailDirectPath`.
 */
export const resolveDownloadableMedia = (
  waMessage: unknown
): { mediaType: WhatsAppMediaType; media: DownloadableMedia } | null => {
  if (!isRecord(waMessage) || !isRecord(waMessage.message)) {
    return null;
  }
  const content = extractMessageContent(waMessage.message);
  const contentType = Object.keys(content).find(
    (key) => (key === 'conversation' || key.includes('Message')) && key !== 'senderKeyDistributionMessage'
  );
  if (!contentType) {
    return null;
  }
  const media = content[contentType];
  if (!isRecord(media)) {
    return null;
  }

  const readPath = (value: unknown): string | null =>
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

  if (!('url' in media) && 'thumbnailDirectPath' in media) {
    const directPath = readPath(media.thumbnailDirectPath);
    return directPath
      ? { mediaType: 'thumbnail-link', media: { mediaKey: media.mediaKey, directPath } }
      : null;
  }
  if (!('url' in media)) {
    return null;
  }

  const mediaType = contentType.replace('Message', '');
  if (!isWhatsAppMediaType(mediaType)) {
    return null;
  }
  return {
    mediaType,
    media: {
      mediaKey: media.mediaKey,
      directPath: readPath(media.directPath),
      url: readPath(media.url),
      fileEncSha256: media.fileEncSha256,
      fileSha256: media.fileSha256,
    },
  };
};

/** Returns the bytes of a 32-byte SHA-256 field when it is well formed, `undefined` otherwise. */
export const readOptionalDigest = (value: unknown): Buffer | undefined => {
  const buffer = tryToBuffer(value);
  return buffer && buffer.length === SHA256_LENGTH ? buffer : undefined;
};
