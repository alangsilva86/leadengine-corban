import { beforeEach, describe, expect, it, vi } from 'vitest';

const uploadObjectMock = vi.hoisted(() => vi.fn());
const createSignedGetUrlMock = vi.hoisted(() => vi.fn());

vi.mock('../supabase-storage', () => ({
  uploadObject: (...args: unknown[]) => uploadObjectMock(...args),
  createSignedGetUrl: (...args: unknown[]) => createSignedGetUrlMock(...args),
}));

describe('whatsapp-media-service', () => {
  beforeEach(() => {
    vi.resetModules();
    uploadObjectMock.mockReset();
    createSignedGetUrlMock.mockReset();
    process.env.WHATSAPP_MEDIA_SIGNED_URL_TTL_SECONDS = '1200';
  });

  it('uploads media buffers to Supabase storage and returns a signed URL descriptor', async () => {
    createSignedGetUrlMock.mockResolvedValueOnce('https://cdn.example.com/signed/url');

    const service = await import('../whatsapp-media-service');
    const buffer = Buffer.from('hello whatsapp');

    const descriptor = await service.saveWhatsAppMedia({
      buffer,
      tenantId: 'Tenant#123',
      instanceId: 'Instance A',
      chatId: '5511999999999@s.whatsapp.net',
      messageId: 'wamid::ABC123',
      originalName: ' Documento .PDF ',
      mimeType: 'application/pdf',
      signedUrlTtlSeconds: 3600,
    });

    expect(uploadObjectMock).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'whatsapp/tenant-123/instance-a/5511999999999-s.whatsapp.net/wamid-abc123.pdf',
        contentType: 'application/pdf',
        contentDisposition: expect.stringContaining('filename="Documento .PDF"'),
      })
    );

    expect(createSignedGetUrlMock).toHaveBeenCalledWith({
      key: 'whatsapp/tenant-123/instance-a/5511999999999-s.whatsapp.net/wamid-abc123.pdf',
      expiresInSeconds: 3600,
    });

    expect(descriptor).toEqual({
      mediaUrl: 'https://cdn.example.com/signed/url',
      expiresInSeconds: 3600,
    });
  });
});
