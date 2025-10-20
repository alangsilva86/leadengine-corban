import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InboundWhatsAppEvent } from '../types';

const findOrCreateOpenTicketByChatMock = vi.hoisted(() => vi.fn());
const upsertMessageByExternalIdMock = vi.hoisted(() => vi.fn());
const downloadInboundMediaMock = vi.hoisted(() => vi.fn());
const saveWhatsAppMediaMock = vi.hoisted(() => vi.fn());
const getWhatsAppUploadsBaseUrlMock = vi.hoisted(() => vi.fn(() => '/uploads/whatsapp'));
const socketToMock = vi.hoisted(() => vi.fn(() => ({ emit: vi.fn() })));
const getSocketServerMock = vi.hoisted(() => vi.fn(() => ({ to: socketToMock })));

vi.mock('@ticketz/storage', () => ({
  findOrCreateOpenTicketByChat: (...args: unknown[]) => findOrCreateOpenTicketByChatMock(...args),
  upsertMessageByExternalId: (...args: unknown[]) => upsertMessageByExternalIdMock(...args),
}));

vi.mock('../../../../config/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../../lib/socket-registry', () => ({
  getSocketServer: (...args: unknown[]) => getSocketServerMock(...args),
  emitToTenant: vi.fn(),
  emitToTicket: vi.fn(),
  emitToAgreement: vi.fn(),
}));

vi.mock('../media-downloader', () => ({
  downloadInboundMediaFromBroker: (...args: unknown[]) => downloadInboundMediaMock(...args),
}));

vi.mock('../../../../services/whatsapp-media-service', () => ({
  saveWhatsAppMedia: (...args: unknown[]) => saveWhatsAppMediaMock(...args),
  getWhatsAppUploadsBaseUrl: () => getWhatsAppUploadsBaseUrlMock(),
}));

const mockTicketId = 'ticket-123';
const mockMessageId = 'message-abc';

describe('handlePassthroughIngest - media handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    findOrCreateOpenTicketByChatMock.mockResolvedValue({
      ticket: { id: mockTicketId },
      wasCreated: false,
    });

    upsertMessageByExternalIdMock.mockResolvedValue({
      message: { id: mockMessageId, ticketId: mockTicketId },
      wasCreated: true,
    });

    downloadInboundMediaMock.mockResolvedValue({
      buffer: Buffer.from('fake-binary'),
      mimeType: 'image/jpeg',
      size: 10_240,
    });

    saveWhatsAppMediaMock.mockResolvedValue({
      mediaUrl: 'https://api.example.com/uploads/whatsapp/media-file.jpg',
      mimeType: 'image/jpeg',
      fileName: 'media-file.jpg',
      size: 10_240,
    });
  });

  it('persists inbound media using broker download when directPath is present', async () => {
    const { handlePassthroughIngest } = await import('../passthrough');

    const event: InboundWhatsAppEvent = {
      id: 'event-1',
      instanceId: 'instance-1',
      direction: 'INBOUND',
      chatId: '5511999999999@s.whatsapp.net',
      externalId: 'wamid-123',
      timestamp: new Date().toISOString(),
      contact: {
        phone: '+5511999999999',
        name: 'Contato',
      },
      message: {
        id: 'wamid-123',
        type: 'IMAGE',
        metadata: {
          directPath: '/vision/media/path',
          mediaKey: 'media-key',
        },
        imageMessage: {
          mimetype: 'image/jpeg',
          caption: 'Foto do cliente',
        },
      },
      metadata: {
        brokerId: 'session-1',
        directPath: '/vision/media/path',
        mediaKey: 'media-key',
      },
    };

    await handlePassthroughIngest(event);

    expect(downloadInboundMediaMock).toHaveBeenCalledWith(
      expect.objectContaining({
        brokerId: 'session-1',
        instanceId: 'instance-1',
        tenantId: 'demo-tenant',
        directPath: '/vision/media/path',
        mediaKey: 'media-key',
      })
    );

    expect(saveWhatsAppMediaMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'demo-tenant',
        mimeType: 'image/jpeg',
      })
    );

    expect(upsertMessageByExternalIdMock).toHaveBeenCalledWith(
      expect.objectContaining({
        media: expect.objectContaining({
          url: 'https://api.example.com/uploads/whatsapp/media-file.jpg',
          mimeType: 'image/jpeg',
          size: 10_240,
        }),
      })
    );
  });

  it('forces media persistence when message already includes external URL', async () => {
    const { handlePassthroughIngest } = await import('../passthrough');

    const event: InboundWhatsAppEvent = {
      id: 'event-2',
      instanceId: 'instance-1',
      direction: 'INBOUND',
      chatId: '5511999999998@s.whatsapp.net',
      externalId: 'wamid-456',
      timestamp: new Date().toISOString(),
      contact: {
        phone: '+5511999999998',
        name: 'Contato',
      },
      message: {
        id: 'wamid-456',
        type: 'IMAGE',
        metadata: {
          downloadUrl: 'https://mmg.whatsapp.net/v/t24/f2/m123/media.jpg',
          directPath: '/o1/v/t24/f2/m123/media.jpg',
          mediaKey: 'media-key-2',
        },
        imageMessage: {
          url: 'https://mmg.whatsapp.net/v/t24/f2/m123/media.jpg',
          mimetype: 'image/jpeg',
        },
      },
      metadata: {
        brokerId: 'session-1',
        directPath: '/o1/v/t24/f2/m123/media.jpg',
        mediaKey: 'media-key-2',
      },
    };

    await handlePassthroughIngest(event);

    expect(downloadInboundMediaMock).toHaveBeenCalledWith(
      expect.objectContaining({
        directPath: '/o1/v/t24/f2/m123/media.jpg',
        mediaKey: 'media-key-2',
      })
    );

    expect(saveWhatsAppMediaMock).toHaveBeenCalled();

    expect(upsertMessageByExternalIdMock).toHaveBeenCalledWith(
      expect.objectContaining({
        media: expect.objectContaining({
          url: 'https://api.example.com/uploads/whatsapp/media-file.jpg',
        }),
      })
    );
  });

  it('skips broker download when media already persisted with trusted base URL', async () => {
    const { handlePassthroughIngest } = await import('../passthrough');

    const event: InboundWhatsAppEvent = {
      id: 'event-3',
      instanceId: 'instance-1',
      direction: 'INBOUND',
      chatId: '5511999999997@s.whatsapp.net',
      externalId: 'wamid-789',
      timestamp: new Date().toISOString(),
      contact: {
        phone: '+5511999999997',
        name: 'Contato',
      },
      message: {
        id: 'wamid-789',
        type: 'IMAGE',
        metadata: {
          mediaUrl: '/uploads/whatsapp/existing-file.jpg',
        },
        imageMessage: {
          mimetype: 'image/jpeg',
        },
      },
      metadata: {
        brokerId: 'session-1',
        directPath: '/o1/v/t24/f2/m456/another.jpg',
      },
    };

    await handlePassthroughIngest(event);

    expect(downloadInboundMediaMock).not.toHaveBeenCalled();
  });
});
