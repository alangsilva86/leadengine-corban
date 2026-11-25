import { Buffer } from 'node:buffer';
import { randomBytes } from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { encryptMediaForTest } from '../../../../lib/whatsapp-crypto/__tests__/test-utils';

const fetchMock = vi.hoisted(() => vi.fn());
const buildWhatsAppBrokerUrlMock = vi.hoisted(() => vi.fn());
const createBrokerTimeoutSignalMock = vi.hoisted(() =>
  vi.fn(() => ({ signal: new AbortController().signal, cancel: vi.fn() }))
);
const handleWhatsAppBrokerErrorMock = vi.hoisted(() => vi.fn());
const resolveWhatsAppBrokerConfigMock = vi.hoisted(() => vi.fn());

const loggerDebugMock = vi.hoisted(() => vi.fn());
const loggerWarnMock = vi.hoisted(() => vi.fn());

const { MockWhatsAppBrokerError, MockWhatsAppBrokerNotConfiguredError } = vi.hoisted(() => ({
  MockWhatsAppBrokerError: class MockWhatsAppBrokerError extends Error {},
  MockWhatsAppBrokerNotConfiguredError: class MockWhatsAppBrokerNotConfiguredError extends Error {},
}));

// `undici.fetch` serves both the WhatsApp CDN (lib/whatsapp-crypto) and the broker.
vi.mock('undici', () => ({
  fetch: (...args: unknown[]) => fetchMock(...args),
}));

vi.mock('../../../../config/logger', () => ({
  logger: {
    debug: (...args: unknown[]) => loggerDebugMock(...args),
    warn: (...args: unknown[]) => loggerWarnMock(...args),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../../services/whatsapp-broker-client', () => ({
  buildWhatsAppBrokerUrl: (...args: unknown[]) => buildWhatsAppBrokerUrlMock(...args),
  createBrokerTimeoutSignal: (...args: unknown[]) => createBrokerTimeoutSignalMock(...args),
  handleWhatsAppBrokerError: (...args: unknown[]) => handleWhatsAppBrokerErrorMock(...args),
  resolveWhatsAppBrokerConfig: (...args: unknown[]) => resolveWhatsAppBrokerConfigMock(...args),
  WhatsAppBrokerError: MockWhatsAppBrokerError,
  WhatsAppBrokerNotConfiguredError: MockWhatsAppBrokerNotConfiguredError,
}));

import * as mediaDownloader from '../media-downloader';
import { downloadInboundMediaFromBroker, downloadViaWhatsAppCdn } from '../media-downloader';

const brokerBuffer = Buffer.from('broker');

const brokerResponse = () => ({
  ok: true,
  headers: {
    get: (header: string) => {
      switch (header.toLowerCase()) {
        case 'content-type':
          return 'application/octet-stream';
        case 'content-length':
          return '6';
        case 'x-request-id':
          return 'req-123';
        default:
          return null;
      }
    },
  },
  arrayBuffer: async () => brokerBuffer,
  json: async () => ({ buffer: brokerBuffer.toString('base64') }),
  status: 200,
});

/** CDN responses keyed by URL; anything else on whatsapp.net is a 404, everything else is the broker. */
const cdn = new Map<string, Buffer>();

const isCdnUrl = (url: string) => new URL(url).hostname.endsWith('.whatsapp.net');

const cdnCalls = () => fetchMock.mock.calls.filter(([url]) => isCdnUrl(String(url)));
const brokerCalls = () => fetchMock.mock.calls.filter(([url]) => !isCdnUrl(String(url)));

const publishOnCdn = (directPath: string, plaintext: Buffer, mediaType: 'image' | 'video' | 'document') => {
  const fixture = encryptMediaForTest(plaintext, mediaType);
  cdn.set(`https://mmg.whatsapp.net${directPath}`, fixture.encrypted);
  return fixture;
};

describe('media-downloader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cdn.clear();
    delete process.env.WHATSAPP_MEDIA_MAX_BYTES;

    resolveWhatsAppBrokerConfigMock.mockReturnValue({
      apiKey: 'broker-key',
      timeoutMs: 10_000,
      baseUrl: 'https://broker.example.com',
    });
    buildWhatsAppBrokerUrlMock.mockImplementation((_, path: string) => `https://broker.example.com${path}`);

    fetchMock.mockImplementation(async (url: string) => {
      if (!isCdnUrl(url)) {
        return brokerResponse();
      }
      const body = cdn.get(url);
      return body
        ? new Response(body, { status: 200, headers: { 'content-length': String(body.length) } })
        : new Response('not found', { status: 404 });
    });
  });

  afterEach(() => {
    delete process.env.WHATSAPP_MEDIA_MAX_BYTES;
  });

  describe('downloadInboundMediaFromBroker', () => {
    it('downloads and decrypts the media straight from the WhatsApp CDN', async () => {
      const plaintext = randomBytes(2048);
      const { mediaKey } = publishOnCdn('/abc/123', plaintext, 'image');

      const result = await downloadInboundMediaFromBroker({
        directPath: '/abc/123',
        mediaKey: mediaKey.toString('base64'),
        mediaType: 'IMAGE',
      });

      expect(result).toEqual({ buffer: plaintext, mimeType: 'image/jpeg', fileName: null, size: plaintext.length });
      expect(cdnCalls()).toHaveLength(1);
      const [url, init] = cdnCalls()[0] as [string, { headers: Record<string, string>; redirect: string }];
      expect(url).toBe('https://mmg.whatsapp.net/abc/123');
      expect(init.redirect).toBe('manual');
      expect(init.headers).toMatchObject({ Origin: 'https://web.whatsapp.com', 'User-Agent': 'Mozilla/5.0 (LeadEngine WhatsApp)' });
      expect(brokerCalls()).toHaveLength(0);
    });

    it('uses the media type to derive the keys (VIDEO)', async () => {
      const plaintext = randomBytes(100);
      const { mediaKey } = publishOnCdn('/video/1', plaintext, 'video');

      const result = await downloadInboundMediaFromBroker({
        directPath: 'video/1',
        mediaKey: mediaKey.toString('base64'),
        mediaType: 'VIDEO',
      });

      expect(result).toEqual({ buffer: plaintext, mimeType: 'video/mp4', fileName: null, size: 100 });
    });

    it('falls back to the broker when the CDN file fails the MAC check', async () => {
      const { mediaKey } = publishOnCdn('/abc/123', randomBytes(64), 'image');
      const tampered = Buffer.from(cdn.get('https://mmg.whatsapp.net/abc/123')!);
      tampered[0] = (tampered[0] ?? 0) ^ 0xff;
      cdn.set('https://mmg.whatsapp.net/abc/123', tampered);

      const result = await downloadInboundMediaFromBroker({
        brokerId: 'session-1',
        directPath: '/abc/123',
        mediaKey: mediaKey.toString('base64'),
        mediaType: 'DOCUMENT',
        instanceId: 'instance-1',
        tenantId: 'tenant-1',
        messageId: 'message-1',
      });

      expect(result).toEqual({ buffer: brokerBuffer, mimeType: 'application/octet-stream', fileName: null, size: 6 });
      expect(cdnCalls()).toHaveLength(1);
      expect(brokerCalls()).toHaveLength(1);
      expect(loggerDebugMock).toHaveBeenCalledWith(
        'WhatsApp direct media download failed (CDN)',
        expect.objectContaining({
          errorCode: 'INVALID_MAC',
          tenantId: 'tenant-1',
          instanceId: 'instance-1',
          messageId: 'message-1',
        })
      );
    });

    it('delegates to the broker without touching the CDN when the media key is invalid', async () => {
      const result = await downloadInboundMediaFromBroker({
        brokerId: 'session-1',
        directPath: '/abc/123',
        mediaKey: 'key-123',
        mediaType: 'DOCUMENT',
        instanceId: 'instance-1',
        tenantId: 'tenant-1',
        messageId: 'message-1',
      });

      expect(result).toEqual({ buffer: brokerBuffer, mimeType: 'application/octet-stream', fileName: null, size: 6 });
      expect(cdnCalls()).toHaveLength(0);
      expect(brokerCalls()).toHaveLength(1);
      expect(loggerDebugMock).toHaveBeenCalledWith(
        'WhatsApp direct media download failed (CDN)',
        expect.objectContaining({ errorCode: 'INVALID_INPUT', messageId: 'message-1' })
      );
    });

    it('never fetches non-WhatsApp hosts taken from the payload', async () => {
      const result = await downloadInboundMediaFromBroker({
        brokerId: 'session-1',
        directPath: 'http://169.254.169.254/latest/meta-data',
        mediaKey: randomBytes(32).toString('base64'),
        mediaType: 'IMAGE',
      });

      expect(result?.buffer).toEqual(brokerBuffer);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(String(fetchMock.mock.calls[0]?.[0])).toBe('https://broker.example.com/instances/session-1/media/download');
      expect(loggerDebugMock).toHaveBeenCalledWith(
        'WhatsApp direct media download failed (CDN)',
        expect.objectContaining({ errorCode: 'HOST_NOT_ALLOWED' })
      );
    });

    it('respects WHATSAPP_MEDIA_MAX_BYTES and falls back to the broker', async () => {
      process.env.WHATSAPP_MEDIA_MAX_BYTES = '1024';
      const { mediaKey } = publishOnCdn('/big', randomBytes(4096), 'image');

      const result = await downloadInboundMediaFromBroker({
        brokerId: 'session-1',
        directPath: '/big',
        mediaKey: mediaKey.toString('base64'),
        mediaType: 'IMAGE',
      });

      expect(result?.buffer).toEqual(brokerBuffer);
      expect(loggerDebugMock).toHaveBeenCalledWith(
        'WhatsApp direct media download failed (CDN)',
        expect.objectContaining({ errorCode: 'TOO_LARGE' })
      );
    });
  });

  describe('downloadViaWhatsAppCdn', () => {
    it('no longer exports the Baileys-named alias', () => {
      expect(mediaDownloader).not.toHaveProperty('downloadViaBaileys');
    });

    it('downloads the media of a full WAMessage and reads metadata from the media record', async () => {
      const plaintext = randomBytes(300);
      const { mediaKey, fileSha256, fileEncSha256 } = publishOnCdn('/v/t62/img', plaintext, 'image');

      const result = await downloadViaWhatsAppCdn({
        key: { id: 'wamid-1', remoteJid: '5511999999999@s.whatsapp.net' },
        message: {
          imageMessage: {
            url: 'https://mmg.whatsapp.net/v/t62/img',
            directPath: '/v/t62/img',
            mediaKey: mediaKey.toString('base64'),
            fileSha256: fileSha256.toString('base64'),
            fileEncSha256: fileEncSha256.toString('base64'),
            mimetype: 'image/png',
            fileLength: '300',
          },
        },
      });

      expect(result).toEqual({ buffer: plaintext, mimeType: 'image/png', fileName: null, size: 300 });
      expect(cdnCalls()).toHaveLength(1);
    });

    it('falls back to the bare media record (no `message` wrapper)', async () => {
      const plaintext = randomBytes(50);
      const { mediaKey } = publishOnCdn('/v/t62/doc', plaintext, 'document');

      const result = await downloadViaWhatsAppCdn({
        documentMessage: {
          directPath: '/v/t62/doc',
          mediakey: mediaKey.toString('base64'),
          fileName: 'contrato.pdf',
          mimetype: 'application/pdf',
        },
      });

      expect(result).toEqual({
        buffer: plaintext,
        mimeType: 'application/pdf',
        fileName: 'contrato.pdf',
        size: 50,
      });
    });

    it('returns null when nothing can be downloaded (callers then use the broker)', async () => {
      const result = await downloadViaWhatsAppCdn({
        key: { id: 'x' },
        message: {
          imageMessage: { url: 'https://mmg.whatsapp.net/missing', mediaKey: randomBytes(32).toString('base64') },
        },
      });

      expect(result).toBeNull();
      expect(loggerDebugMock).toHaveBeenCalledWith(
        'whatsapp-inbound: falha ao baixar a mídia da mensagem pelo CDN do WhatsApp',
        expect.objectContaining({ errorCode: 'DOWNLOAD_FAILED' })
      );
      expect(await downloadViaWhatsAppCdn(null)).toBeNull();
    });
  });
});
