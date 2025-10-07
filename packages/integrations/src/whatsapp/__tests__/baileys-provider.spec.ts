import { describe, expect, it, vi, beforeEach } from 'vitest';
import { downloadMediaMessage, type WAMessage } from '@whiskeysockets/baileys';
import { BaileysWhatsAppProvider } from '../baileys-provider';

vi.mock('@whiskeysockets/baileys', () => ({
  downloadMediaMessage: vi.fn(),
  makeWASocket: vi.fn(),
  DisconnectReason: {},
  useMultiFileAuthState: vi.fn(),
  makeCacheableSignalKeyStore: vi.fn()
}));

const mockedDownload = vi.mocked(downloadMediaMessage);

describe('BaileysWhatsAppProvider - media handling', () => {
  beforeEach(() => {
    mockedDownload.mockReset();
  });

  it('emits message event with mediaUrl when receiving media', async () => {
    const provider = new BaileysWhatsAppProvider({
      instanceId: 'test',
      sessionPath: 'test'
    });

    const socketStub = {
      user: { id: 'bot@s.whatsapp.net' }
    } as any;

    (provider as any).socket = socketStub;

    const spy = vi.fn();
    provider.on('message', spy);

    const message: WAMessage = {
      key: {
        id: 'MSG123',
        remoteJid: '123@s.whatsapp.net',
        fromMe: false
      },
      messageTimestamp: 1700000000,
      message: {
        imageMessage: {
          caption: 'hello',
          mimetype: 'image/png'
        }
      }
    } as any;

    mockedDownload.mockResolvedValue(Buffer.from('media-content'));

    await (provider as any).handleIncomingMessages({
      type: 'notify',
      messages: [message]
    });

    expect(spy).toHaveBeenCalledTimes(1);
    const emittedMessage = spy.mock.calls[0][0];
    expect(emittedMessage.mediaUrl).toMatch(/^data:image\/png;base64,/);
    expect(emittedMessage.mediaType).toBe('image/png');
    expect(emittedMessage.mediaSizeBytes).toBe(Buffer.from('media-content').length);
  });
});
