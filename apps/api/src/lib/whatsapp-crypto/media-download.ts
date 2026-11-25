import { Buffer } from 'node:buffer';
import { fetch as undiciFetch } from 'undici';

import { WhatsAppCryptoError } from './errors';
import {
  decryptMediaBuffer,
  deriveMediaKeys,
  readOptionalDigest,
  resolveDownloadableMedia,
  type DownloadableMedia,
  type WhatsAppMediaType,
} from './media';

export const DEFAULT_WHATSAPP_MEDIA_ORIGIN = 'https://mmg.whatsapp.net';
export const DEFAULT_MEDIA_DOWNLOAD_TIMEOUT_MS = 15_000;
export const DEFAULT_MAX_MEDIA_BYTES = 64 * 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 3;
const WHATSAPP_WEB_ORIGIN = 'https://web.whatsapp.com';
const WHATSAPP_MEDIA_DOMAIN = 'whatsapp.net';

/** Minimal response surface used by the downloader (satisfied by undici/global `fetch`). */
export interface MediaFetchResponse {
  status: number;
  ok: boolean;
  headers: { get(name: string): string | null };
  body: (AsyncIterable<Uint8Array> & { cancel?: (reason?: unknown) => Promise<void> }) | null;
}

export type MediaFetch = (
  url: string,
  init: { method: 'GET'; headers: Record<string, string>; redirect: 'manual'; signal: AbortSignal }
) => Promise<MediaFetchResponse>;

export interface MediaDownloadOptions {
  /** Whole-download timeout (headers + body). Default 15 s. */
  timeoutMs?: number;
  /** Maximum size of the encrypted blob. Default 64 MiB. Enforced on Content-Length and while streaming. */
  maxBytes?: number;
  /** Extra request headers (the WhatsApp Web `Origin` is always sent). */
  headers?: Record<string, string>;
  /** Caller cancellation. */
  signal?: AbortSignal;
  /** Maximum redirects to follow; every hop is re-checked against `allowUrl`. Default 3. */
  maxRedirects?: number;
  /** Injectable for tests: fetch implementation (defaults to undici `fetch`). */
  fetch?: MediaFetch;
  /** Injectable for tests: URL allow-list (defaults to {@link isAllowedWhatsAppMediaUrl}). */
  allowUrl?: (url: URL) => boolean;
  /** Injectable for tests: origin used to turn a `directPath` into a URL. Default `https://mmg.whatsapp.net`. */
  mediaOrigin?: string;
}

/**
 * SSRF guard: only `https://<host>.whatsapp.net` (default port, no credentials) is downloadable.
 * Message payloads come from the network, so their `url`/`directPath` must never select the host.
 */
export const isAllowedWhatsAppMediaUrl = (url: URL): boolean => {
  if (url.protocol !== 'https:' || url.username || url.password) {
    return false;
  }
  if (url.port !== '' && url.port !== '443') {
    return false;
  }
  const hostname = url.hostname.toLowerCase();
  return hostname === WHATSAPP_MEDIA_DOMAIN || hostname.endsWith(`.${WHATSAPP_MEDIA_DOMAIN}`);
};

const parseUrl = (value: string, base?: string): URL | null => {
  try {
    return new URL(value, base);
  } catch {
    return null;
  }
};

/**
 * Picks the download URL: `url` when it is allowed, otherwise `<mediaOrigin><directPath>`
 * (WhatsApp Web/Baileys use `https://mmg.whatsapp.net` + directPath).
 */
export const resolveMediaDownloadUrl = (
  media: Pick<DownloadableMedia, 'url' | 'directPath'>,
  options: Pick<MediaDownloadOptions, 'allowUrl' | 'mediaOrigin'> = {}
): URL => {
  const allowUrl = options.allowUrl ?? isAllowedWhatsAppMediaUrl;
  const rawUrl = typeof media.url === 'string' ? media.url.trim() : '';
  const rawPath = typeof media.directPath === 'string' ? media.directPath.trim() : '';
  let rejectedHost: string | null = null;

  const candidates: string[] = [];
  if (rawUrl) {
    candidates.push(rawUrl);
  }
  if (/^https?:\/\//iu.test(rawPath)) {
    candidates.push(rawPath);
  }
  for (const candidate of candidates) {
    const parsed = parseUrl(candidate);
    if (parsed && allowUrl(parsed)) {
      return parsed;
    }
    rejectedHost = parsed?.host ?? 'invalid-url';
  }

  if (rawPath && !/^https?:\/\//iu.test(rawPath)) {
    const origin = parseUrl(options.mediaOrigin ?? DEFAULT_WHATSAPP_MEDIA_ORIGIN);
    const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
    // `//host/…` or `\` would let the path pick another host.
    if (origin && !path.startsWith('//') && !path.includes('\\')) {
      const parsed = parseUrl(`${origin.origin}${path}`);
      if (parsed && parsed.origin === origin.origin && allowUrl(parsed)) {
        return parsed;
      }
    }
    rejectedHost = rejectedHost ?? 'directPath';
  }

  if (rejectedHost) {
    throw new WhatsAppCryptoError('HOST_NOT_ALLOWED', 'Media URL is not an allowed WhatsApp CDN host', {
      details: { host: rejectedHost },
    });
  }
  throw new WhatsAppCryptoError('INVALID_INPUT', 'Media has neither url nor directPath', {
    details: { field: 'url' },
  });
};

const discardBody = async (response: MediaFetchResponse): Promise<void> => {
  try {
    await response.body?.cancel?.();
  } catch {
    // ignore: we are discarding the body anyway
  }
};

const readBodyWithLimit = async (
  response: MediaFetchResponse,
  maxBytes: number,
  abort: () => void
): Promise<Buffer> => {
  if (!response.body) {
    return Buffer.alloc(0);
  }
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of response.body) {
    total += chunk.byteLength;
    if (total > maxBytes) {
      abort();
      throw new WhatsAppCryptoError('TOO_LARGE', 'Media download exceeds the size limit', {
        details: { maxBytes },
      });
    }
    chunks.push(Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength));
  }
  return Buffer.concat(chunks, total);
};

const positiveOr = (value: number | undefined, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;

/** Downloads the encrypted blob from an (already allow-listed) URL with timeout, size and redirect limits. */
export const downloadEncryptedMedia = async (url: URL, options: MediaDownloadOptions = {}): Promise<Buffer> => {
  const allowUrl = options.allowUrl ?? isAllowedWhatsAppMediaUrl;
  const fetchImpl: MediaFetch = options.fetch ?? (undiciFetch as unknown as MediaFetch);
  const timeoutMs = positiveOr(options.timeoutMs, DEFAULT_MEDIA_DOWNLOAD_TIMEOUT_MS);
  const maxBytes = positiveOr(options.maxBytes, DEFAULT_MAX_MEDIA_BYTES);
  const maxRedirects = Math.max(0, Math.floor(options.maxRedirects ?? DEFAULT_MAX_REDIRECTS));
  const headers: Record<string, string> = {
    'Accept-Encoding': 'identity',
    ...options.headers,
    Origin: WHATSAPP_WEB_ORIGIN,
  };

  if (!allowUrl(url)) {
    throw new WhatsAppCryptoError('HOST_NOT_ALLOWED', 'Media URL is not an allowed WhatsApp CDN host', {
      details: { host: url.host },
    });
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onCallerAbort = () => controller.abort();
  if (options.signal?.aborted) {
    controller.abort();
  }
  options.signal?.addEventListener('abort', onCallerAbort, { once: true });

  try {
    let current = url;
    for (let redirects = 0; ; redirects += 1) {
      const response = await fetchImpl(current.toString(), {
        method: 'GET',
        headers,
        redirect: 'manual',
        signal: controller.signal,
      });

      const location = response.status >= 300 && response.status < 400 ? response.headers.get('location') : null;
      if (location) {
        await discardBody(response);
        const next = parseUrl(location, current.toString());
        if (redirects >= maxRedirects) {
          throw new WhatsAppCryptoError('DOWNLOAD_FAILED', 'Too many redirects while downloading media', {
            details: { status: response.status, maxRedirects },
          });
        }
        if (!next || !allowUrl(next)) {
          throw new WhatsAppCryptoError('HOST_NOT_ALLOWED', 'Media redirect target is not an allowed WhatsApp CDN host', {
            details: { host: next?.host ?? 'invalid-url' },
          });
        }
        current = next;
        continue;
      }

      if (!response.ok) {
        await discardBody(response);
        throw new WhatsAppCryptoError('DOWNLOAD_FAILED', `Media download failed with HTTP ${response.status}`, {
          details: { status: response.status, host: current.host },
        });
      }

      const declaredLength = Number(response.headers.get('content-length') ?? Number.NaN);
      if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
        await discardBody(response);
        throw new WhatsAppCryptoError('TOO_LARGE', 'Media download exceeds the size limit', {
          details: { maxBytes, contentLength: declaredLength },
        });
      }

      return await readBodyWithLimit(response, maxBytes, () => controller.abort());
    }
  } catch (error) {
    if (error instanceof WhatsAppCryptoError) {
      throw error;
    }
    if (timedOut) {
      throw new WhatsAppCryptoError('TIMEOUT', `Media download timed out after ${timeoutMs} ms`, {
        details: { timeoutMs },
      });
    }
    throw new WhatsAppCryptoError(
      'DOWNLOAD_FAILED',
      options.signal?.aborted ? 'Media download aborted' : 'Media download failed',
      { details: { host: url.host }, cause: error }
    );
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onCallerAbort);
  }
};

/**
 * Downloads a media file from the WhatsApp CDN and decrypts it (equivalent to Baileys
 * `downloadContentFromMessage` + reading the stream into a Buffer, plus MAC/hash verification).
 * Keys and URL are validated before any network access.
 */
export const downloadAndDecryptMedia = async (
  media: DownloadableMedia,
  mediaType: WhatsAppMediaType,
  options: MediaDownloadOptions = {}
): Promise<Buffer> => {
  const keys = deriveMediaKeys(media.mediaKey, mediaType);
  const url = resolveMediaDownloadUrl(media, options);
  const encrypted = await downloadEncryptedMedia(url, options);
  return decryptMediaBuffer(encrypted, keys, {
    fileEncSha256: readOptionalDigest(media.fileEncSha256),
    fileSha256: readOptionalDigest(media.fileSha256),
  });
};

/**
 * Downloads the media of a `WAMessage`-shaped object (equivalent to Baileys
 * `downloadMediaMessage(message, 'buffer')`, without the re-upload request, which needs a live socket).
 */
export const downloadAndDecryptMessageMedia = async (
  waMessage: unknown,
  options: MediaDownloadOptions = {}
): Promise<{ buffer: Buffer; mediaType: WhatsAppMediaType }> => {
  const resolved = resolveDownloadableMedia(waMessage);
  if (!resolved) {
    throw new WhatsAppCryptoError('INVALID_INPUT', 'Message does not contain downloadable media', {
      details: { field: 'message' },
    });
  }
  const buffer = await downloadAndDecryptMedia(resolved.media, resolved.mediaType, options);
  return { buffer, mediaType: resolved.mediaType };
};
