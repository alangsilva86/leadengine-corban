/**
 * Typed errors for the WhatsApp crypto module.
 *
 * Messages and `details` never contain key material, plaintext or ciphertext: they are safe to
 * log as-is. Only lengths, media types, hosts and HTTP statuses are ever attached.
 */
export type WhatsAppCryptoErrorCode =
  /** Missing/invalid argument (wrong key length, undecodable base64, truncated blob, unknown media type…). */
  | 'INVALID_INPUT'
  /** Media HMAC-SHA256 (first 10 bytes) does not match: wrong key, tampered or truncated file. */
  | 'INVALID_MAC'
  /** AES decryption failed (GCM authentication failure, bad CBC padding). */
  | 'DECRYPT_FAILED'
  /** `fileEncSha256` / `fileSha256` from the message does not match the downloaded/decrypted bytes. */
  | 'HASH_MISMATCH'
  /** Decrypted payload is not a well-formed protobuf message. */
  | 'MALFORMED_PROTOBUF'
  /** URL (or redirect target) is not an allowed WhatsApp CDN host. */
  | 'HOST_NOT_ALLOWED'
  /** Download exceeds the configured size limit. */
  | 'TOO_LARGE'
  /** Download did not complete within the configured timeout. */
  | 'TIMEOUT'
  /** Network error or non-2xx HTTP status while downloading. */
  | 'DOWNLOAD_FAILED';

export type WhatsAppCryptoErrorDetails = Record<string, string | number | boolean | null>;

export class WhatsAppCryptoError extends Error {
  readonly code: WhatsAppCryptoErrorCode;
  readonly details: WhatsAppCryptoErrorDetails | undefined;

  constructor(
    code: WhatsAppCryptoErrorCode,
    message: string,
    options: { details?: WhatsAppCryptoErrorDetails; cause?: unknown } = {}
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'WhatsAppCryptoError';
    this.code = code;
    this.details = options.details;
  }
}

export const isWhatsAppCryptoError = (
  error: unknown,
  code?: WhatsAppCryptoErrorCode
): error is WhatsAppCryptoError =>
  error instanceof WhatsAppCryptoError && (code === undefined || error.code === code);
