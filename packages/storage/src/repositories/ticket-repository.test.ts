import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@prisma/client', () => ({
  Prisma: {},
  $Enums: {
    MessageType: {
      TEXT: 'TEXT',
      IMAGE: 'IMAGE',
      VIDEO: 'VIDEO',
      AUDIO: 'AUDIO',
      DOCUMENT: 'DOCUMENT',
      STICKER: 'STICKER',
    },
  },
}));

const { findFirstMock, updateMock } = vi.hoisted(() => ({
  findFirstMock: vi.fn(),
  updateMock: vi.fn(),
}));

vi.mock('../prisma-client', () => ({
  getPrismaClient: () => ({
    message: {
      findFirst: findFirstMock,
      update: updateMock,
    },
  }),
}));

import { upsertMessageByExternalId } from './ticket-repository';

const baseExistingMessage = {
  id: 'message-1',
  tenantId: 'tenant-1',
  ticketId: 'ticket-1',
  contactId: 'contact-1',
  userId: null,
  instanceId: null,
  direction: 'INBOUND',
  type: 'TEXT',
  content: 'legacy',
  caption: null,
  mediaUrl: null,
  mediaFileName: null,
  mediaType: null,
  mediaSize: null,
  status: 'SENT',
  externalId: 'ext-123',
  quotedMessageId: null,
  metadata: {},
  idempotencyKey: null,
  deliveredAt: null,
  readAt: null,
  createdAt: new Date('2023-01-01T00:00:00Z'),
  updatedAt: new Date('2023-01-01T00:00:00Z'),
};

describe('upsertMessageByExternalId', () => {
  beforeEach(() => {
    findFirstMock.mockReset();
    updateMock.mockReset();
  });

  it('preserves media classification when only base64 media payload is provided', async () => {
    const existing = { ...baseExistingMessage };

    findFirstMock.mockResolvedValue(existing);
    updateMock.mockImplementation(async ({ data }) => ({
      ...existing,
      ...data,
      metadata: data.metadata as Record<string, unknown>,
      updatedAt: data.updatedAt ?? new Date('2024-01-01T00:00:00Z'),
      type: data.type ?? 'TEXT',
      mediaUrl: data.mediaUrl ?? null,
      mediaFileName: data.mediaFileName ?? null,
      mediaType: data.mediaType ?? null,
      mediaSize: data.mediaSize ?? null,
    }));

    const result = await upsertMessageByExternalId({
      tenantId: 'tenant-1',
      ticketId: 'ticket-1',
      chatId: '123',
      direction: 'inbound',
      externalId: 'ext-123',
      type: 'media',
      text: null,
      media: {
        mediaType: 'image',
        base64: '   data-123   ',
        mimeType: 'image/jpeg',
        fileName: 'photo.jpg',
      },
      metadata: { sourceInstance: 'instance-1' },
      timestamp: new Date('2024-01-01T00:00:00Z'),
    });

    expect(findFirstMock).toHaveBeenCalledOnce();
    expect(updateMock).toHaveBeenCalledOnce();

    const updateArgs = updateMock.mock.calls[0][0];
    expect(updateArgs.data.type).toBe('IMAGE');
    expect(updateArgs.data.mediaUrl).toBeNull();
    expect(updateArgs.data.mediaFileName).toBe('photo.jpg');
    expect(updateArgs.data.mediaType).toBe('image/jpeg');

    expect(result.wasCreated).toBe(false);
    expect(result.message.type).toBe('media');
    expect(result.message.media).not.toBeNull();
    expect(result.message.media?.base64).toBe('data-123');
    expect(result.message.media?.mediaType).toBe('image');
    expect(result.message.media?.url).toBeNull();
  });
});
