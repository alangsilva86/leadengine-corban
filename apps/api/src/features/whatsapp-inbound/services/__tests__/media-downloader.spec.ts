import { Readable } from 'node:stream';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const downloadMediaMessageMock = vi.hoisted(() => vi.fn());
const downloadContentFromMessageMock = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn());
const buildWhatsAppBrokerUrlMock = vi.hoisted(() => vi.fn());
const createBrokerTimeoutSignalMock = vi.hoisted(() =>
  vi.fn(() => ({ signal: new AbortController().signal, cancel: vi.fn() }))
);
const handleWhatsAppBrokerErrorMock = vi.hoisted(() => vi.fn());
const resolveWhatsAppBrokerConfigMock = vi.hoisted(() => vi.fn());

const loggerDebugMock = vi.hoisted(() => vi.fn());
const loggerWarnMock = vi.hoisted(() => vi.fn());

class MockWhatsAppBrokerError extends Error {}
class MockWhatsAppBrokerNotConfiguredError extends Error {}

vi.mock('@whiskeysockets/baileys', () => ({
  downloadMediaMessage: (...args: unknown[]) => downloadMediaMessageMock(...args),
  downloadContentFromMessage: (...args: unknown[]) => downloadContentFromMessageMock(...args),
}));

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

describe('downloadInboundMediaFromBroker', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    resolveWhatsAppBrokerConfigMock.mockReturnValue({
      apiKey: 'broker-key',
      timeoutMs: 10_000,
      baseUrl: 'https://broker.example.com',
    });

    buildWhatsAppBrokerUrlMock.mockImplementation((_, path: string) => `https://broker.example.com${path}`);

    const brokerBuffer = Buffer.from('broker');

    fetchMock.mockResolvedValue({
      ok: true,
      headers: {
        get: (header: string) => {
          if (header.toLowerCase() === 'content-type') {
            return 'application/octet-stream';
          }
          if (header.toLowerCase() === 'content-disposition') {
            return null;
          }
          if (header.toLowerCase() === 'content-length') {
            return '6';
          }
          if (header.toLowerCase() === 'x-request-id') {
            return 'req-123';
          }
          return null;
        },
      },
      arrayBuffer: async () => brokerBuffer,
      json: async () => ({ buffer: brokerBuffer.toString('base64') }),
      status: 200,
    });
  });

  it('returns buffer when downloadMediaMessage succeeds', async () => {
    downloadMediaMessageMock.mockResolvedValue(Buffer.from('media-from-message'));

    const { downloadInboundMediaFromBroker } = await import('../media-downloader');

    const result = await downloadInboundMediaFromBroker({
      directPath: '/abc/123',
      mediaKey: 'key-123',
      mediaType: 'IMAGE',
    });

    expect(result).toEqual({
      buffer: Buffer.from('media-from-message'),
      mimeType: 'image/jpeg',
      fileName: null,
      size: Buffer.from('media-from-message').length,
    });

    expect(downloadMediaMessageMock).toHaveBeenCalledTimes(1);
    expect(downloadContentFromMessageMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls back to downloadContentFromMessage when downloadMediaMessage fails', async () => {
    downloadMediaMessageMock.mockRejectedValue(new Error('download-failed'));
    downloadContentFromMessageMock.mockResolvedValue(Readable.from([Buffer.from('media-from-stream')]));

    const { downloadInboundMediaFromBroker } = await import('../media-downloader');

    const result = await downloadInboundMediaFromBroker({
      directPath: '/abc/123',
      mediaKey: 'key-123',
      mediaType: 'VIDEO',
      tenantId: 'tenant-1',
      instanceId: 'instance-1',
      messageId: 'message-1',
    });

    expect(result).toEqual({
      buffer: Buffer.from('media-from-stream'),
      mimeType: 'video/mp4',
      fileName: null,
      size: Buffer.from('media-from-stream').length,
    });

    expect(downloadMediaMessageMock).toHaveBeenCalledTimes(1);
    expect(downloadContentFromMessageMock).toHaveBeenCalledTimes(1);
    expect(loggerDebugMock).toHaveBeenCalledWith(
      'WhatsApp Baileys direct media download failed via downloadMediaMessage',
      expect.objectContaining({
        tenantId: 'tenant-1',
        instanceId: 'instance-1',
        messageId: 'message-1',
      })
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('delegates to broker when Baileys helpers cannot download the media', async () => {
    downloadMediaMessageMock.mockRejectedValue(new Error('message-helper-failed'));
    downloadContentFromMessageMock.mockRejectedValue(new Error('content-helper-failed'));

    const { downloadInboundMediaFromBroker } = await import('../media-downloader');

    const result = await downloadInboundMediaFromBroker({
      brokerId: 'session-1',
      directPath: '/abc/123',
      mediaKey: 'key-123',
      mediaType: 'DOCUMENT',
      instanceId: 'instance-1',
      tenantId: 'tenant-1',
      messageId: 'message-1',
    });

    expect(result).toEqual({
      buffer: Buffer.from('broker'),
      mimeType: 'application/octet-stream',
      fileName: null,
      size: 6,
    });

    expect(downloadMediaMessageMock).toHaveBeenCalledTimes(1);
    expect(downloadContentFromMessageMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(loggerDebugMock).toHaveBeenCalledWith(
      'WhatsApp Baileys direct media download failed via downloadContentFromMessage',
      expect.objectContaining({
        tenantId: 'tenant-1',
        instanceId: 'instance-1',
        messageId: 'message-1',
      })
    );
  });
});

