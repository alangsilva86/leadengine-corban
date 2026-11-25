/**
 * Test-only encoders: produce WhatsApp-encrypted media / poll votes straight from the protocol
 * description with node:crypto, independently of the decrypting code under test.
 */
import { Buffer } from 'node:buffer';
import { createCipheriv, createHash, createHmac, hkdfSync, randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

const MEDIA_INFO: Record<string, string> = {
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
};

export const sha256 = (data: Uint8Array): Buffer => createHash('sha256').update(data).digest();

export const expandMediaKeyForTest = (mediaKey: Buffer, mediaType: string) => {
  const info = MEDIA_INFO[mediaType];
  if (info === undefined) {
    throw new Error(`unknown media type ${mediaType}`);
  }
  const expanded = Buffer.from(hkdfSync('sha256', mediaKey, Buffer.alloc(32), `WhatsApp ${info} Keys`, 112));
  return { iv: expanded.subarray(0, 16), cipherKey: expanded.subarray(16, 48), macKey: expanded.subarray(48, 80) };
};

export interface EncryptedMediaFixture {
  mediaKey: Buffer;
  plaintext: Buffer;
  encrypted: Buffer;
  fileSha256: Buffer;
  fileEncSha256: Buffer;
}

/** `AES-256-CBC(plaintext) ‖ HMAC-SHA256(macKey, iv ‖ ciphertext)[0,10)`. */
export const encryptMediaForTest = (
  plaintext: Buffer,
  mediaType: string,
  mediaKey: Buffer = randomBytes(32),
  keys = expandMediaKeyForTest(mediaKey, mediaType)
): EncryptedMediaFixture => {
  const cipher = createCipheriv('aes-256-cbc', keys.cipherKey, keys.iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const mac = createHmac('sha256', keys.macKey).update(keys.iv).update(ciphertext).digest().subarray(0, 10);
  const encrypted = Buffer.concat([ciphertext, mac]);
  return { mediaKey, plaintext, encrypted, fileSha256: sha256(plaintext), fileEncSha256: sha256(encrypted) };
};

const encodeVarint = (value: number): Buffer => {
  const bytes: number[] = [];
  let remaining = value;
  while (remaining >= 0x80) {
    bytes.push((remaining % 128) | 0x80);
    remaining = Math.floor(remaining / 128);
  }
  bytes.push(remaining);
  return Buffer.from(bytes);
};

export const protoField = {
  bytes: (fieldNumber: number, value: Uint8Array): Buffer =>
    Buffer.concat([encodeVarint(fieldNumber * 8 + 2), encodeVarint(value.length), value]),
  varint: (fieldNumber: number, value: number): Buffer =>
    Buffer.concat([encodeVarint(fieldNumber * 8), encodeVarint(value)]),
  fixed64: (fieldNumber: number, value: Uint8Array = randomBytes(8)): Buffer =>
    Buffer.concat([encodeVarint(fieldNumber * 8 + 1), Buffer.from(value).subarray(0, 8)]),
  fixed32: (fieldNumber: number, value: Uint8Array = randomBytes(4)): Buffer =>
    Buffer.concat([encodeVarint(fieldNumber * 8 + 5), Buffer.from(value).subarray(0, 4)]),
  group: (fieldNumber: number, inner: Buffer): Buffer =>
    Buffer.concat([encodeVarint(fieldNumber * 8 + 3), inner, encodeVarint(fieldNumber * 8 + 4)]),
};

/** `PollVoteMessage { repeated bytes selectedOptions = 1 }`, optionally interleaved with unknown fields. */
export const encodePollVoteMessage = (selectedOptions: Uint8Array[], unknownFields: Buffer[] = []): Buffer => {
  const parts: Buffer[] = [];
  selectedOptions.forEach((option, index) => {
    if (unknownFields[index]) {
      parts.push(unknownFields[index]!);
    }
    parts.push(protoField.bytes(1, option));
  });
  parts.push(...unknownFields.slice(selectedOptions.length));
  return Buffer.concat(parts);
};

export interface PollVoteFixtureInput {
  pollMsgId: string;
  pollCreatorJid: string;
  voterJid: string;
  pollEncKey: Buffer;
  encIv: Buffer;
  plaintext: Buffer;
}

export const encryptPollVoteForTest = ({
  pollMsgId,
  pollCreatorJid,
  voterJid,
  pollEncKey,
  encIv,
  plaintext,
}: PollVoteFixtureInput): Buffer => {
  const sign = Buffer.concat([
    Buffer.from(pollMsgId),
    Buffer.from(pollCreatorJid),
    Buffer.from(voterJid),
    Buffer.from('Poll Vote'),
    Buffer.from([1]),
  ]);
  const key0 = createHmac('sha256', Buffer.alloc(32)).update(pollEncKey).digest();
  const key = createHmac('sha256', key0).update(sign).digest();
  const cipher = createCipheriv('aes-256-gcm', key, encIv);
  cipher.setAAD(Buffer.from(`${pollMsgId}\u0000${voterJid}`));
  return Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
};

export type RouteHandler = (req: IncomingMessage, res: ServerResponse) => void;

/** Local HTTP server standing in for the WhatsApp CDN. */
export const startMediaServer = async (
  routes: Map<string, RouteHandler>
): Promise<{ origin: string; server: Server; close: () => Promise<void> }> => {
  const server = createServer((req, res) => {
    const handler = routes.get((req.url ?? '').split('?')[0] ?? '');
    if (!handler) {
      res.statusCode = 404;
      res.end('not found');
      return;
    }
    handler(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    origin: `http://127.0.0.1:${port}`,
    server,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections?.();
        server.close(() => resolve());
      }),
  };
};

export const serveBuffer =
  (body: Buffer, headers: Record<string, string> = {}): RouteHandler =>
  (_req, res) => {
    res.writeHead(200, { 'content-type': 'application/octet-stream', 'content-length': String(body.length), ...headers });
    res.end(body);
  };

export const allowLocalhost = (url: URL): boolean => url.hostname === '127.0.0.1';
