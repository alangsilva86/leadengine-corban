import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as storage from '@ticketz/storage';
import * as supabaseStorage from '../../supabase-storage';
import { listMessages } from './list-messages';

vi.mock('@ticketz/storage', () => ({
  findTicketById: vi.fn(),
  listMessages: vi.fn(),
  updateMessage: vi.fn(),
}));

vi.mock('../../supabase-storage', () => ({
  createSignedGetUrl: vi.fn(),
  readSupabaseS3Config: vi.fn(),
}));

vi.mock('../../../config/logger', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('listMessages (media refresh)', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    (storage.findTicketById as any).mockResolvedValue({
      id: 'ticket-1',
      tenantId: 'tenant-1',
      contactId: 'contact-1',
      queueId: 'queue-1',
      channel: 'WHATSAPP',
      priority: 'MEDIUM',
      stage: 'OPEN',
      status: 'OPEN',
      tags: [],
      metadata: {},
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
    } as any);

    (supabaseStorage.readSupabaseS3Config as any).mockReturnValue({ bucket: 'public-bucket' });
  });

  it('refreshes expired media URLs and updates persistence', async () => {
    const expiredUrl =
      'https://cdn.example.com/public-bucket/whatsapp/tenant/file.jpg?X-Amz-Date=20240101T000000Z&X-Amz-Expires=900';
    const refreshedUrl = `${expiredUrl}&fresh=1`;

    (storage.listMessages as any).mockResolvedValue({
      items: [
        {
          id: 'msg-1',
          tenantId: 'tenant-1',
          ticketId: 'ticket-1',
          contactId: 'contact-1',
          direction: 'INBOUND',
          type: 'DOCUMENT',
          content: '',
          status: 'SENT',
          metadata: { media: { url: expiredUrl, urlExpiresInSeconds: 900 } },
          mediaUrl: expiredUrl,
          createdAt: new Date('2024-01-01T00:00:00Z'),
          updatedAt: new Date('2024-01-01T00:00:00Z'),
        },
      ],
      total: 1,
      page: 1,
      limit: 50,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    } as any);

    (supabaseStorage.createSignedGetUrl as any).mockResolvedValue(refreshedUrl);

    const result = await listMessages('tenant-1', 'ticket-1', { page: 1, limit: 50 });

    expect(result.items[0].mediaUrl).toBe(refreshedUrl);
    expect(result.items[0].metadata?.media).toEqual(
      expect.objectContaining({ url: refreshedUrl, urlExpiresInSeconds: 900 })
    );
    expect(storage.updateMessage).toHaveBeenCalledWith('tenant-1', 'msg-1', {
      mediaUrl: refreshedUrl,
      metadata: expect.objectContaining({
        media: expect.objectContaining({ url: refreshedUrl, urlExpiresInSeconds: 900 }),
      }),
    });
  });
});
