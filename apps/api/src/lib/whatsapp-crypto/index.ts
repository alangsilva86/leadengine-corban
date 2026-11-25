/**
 * Dependency-free (node:crypto + undici) implementation of the two WhatsApp crypto features the
 * API needs: decrypting inbound media from the WhatsApp CDN and decrypting poll votes.
 * See ./README.md for the protocol and the security choices.
 */
export { WhatsAppCryptoError, isWhatsAppCryptoError } from './errors';
export type { WhatsAppCryptoErrorCode, WhatsAppCryptoErrorDetails } from './errors';
export { toBuffer, tryToBuffer } from './bytes';
export type { BinaryInput } from './bytes';
export {
  MEDIA_HKDF_KEY_MAPPING,
  WHATSAPP_MEDIA_TYPES,
  decryptMediaBuffer,
  deriveMediaKeys,
  isWhatsAppMediaType,
  mediaHkdfInfo,
  readOptionalDigest,
  resolveDownloadableMedia,
} from './media';
export type { DecryptMediaOptions, DownloadableMedia, WhatsAppMediaKeys, WhatsAppMediaType } from './media';
export {
  DEFAULT_MAX_MEDIA_BYTES,
  DEFAULT_MEDIA_DOWNLOAD_TIMEOUT_MS,
  DEFAULT_WHATSAPP_MEDIA_ORIGIN,
  downloadAndDecryptMedia,
  downloadAndDecryptMessageMedia,
  downloadEncryptedMedia,
  isAllowedWhatsAppMediaUrl,
  resolveMediaDownloadUrl,
} from './media-download';
export type { MediaDownloadOptions, MediaFetch, MediaFetchResponse } from './media-download';
export { decodePollVoteMessage, decryptPollVote, derivePollVoteKey } from './poll-vote';
export type { EncryptedPollVote, PollVoteDecryptionContext, PollVoteMessage } from './poll-vote';
