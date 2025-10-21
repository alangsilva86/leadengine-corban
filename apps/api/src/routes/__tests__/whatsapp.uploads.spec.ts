import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { errorHandler } from '../../middleware/error-handler';

const setPrismaClientMock = vi.fn();
const saveWhatsAppMediaMock = vi.fn();

vi.mock('@ticketz/storage', () => ({
  setPrismaClient: (...args: unknown[]) => setPrismaClientMock(...args),
}));

vi.mock('../../services/whatsapp-media-service', () => ({
  saveWhatsAppMedia: (...args: unknown[]) => saveWhatsAppMediaMock(...args),
}));

describe('WhatsApp uploads router', () => {
  beforeEach(() => {
    setPrismaClientMock.mockReset();
    saveWhatsAppMediaMock.mockReset();
  });

  const buildApp = async (options: { user?: Record<string, unknown> | null } = {}) => {
    const app = express();

    if (options.user !== null) {
      const user = options.user ?? { id: 'operator-1', tenantId: 'tenant-1' };
      app.use((req, _res, next) => {
        (req as express.Request & { user?: typeof user }).user = user as never;
        next();
      });
    }

    const { whatsappUploadsRouter } = await import('../whatsapp.uploads');
    app.use('/api', whatsappUploadsRouter);
    app.use(errorHandler);

    return app;
  };

  it('uploads media files and returns descriptor metadata', async () => {
    const descriptor = {
      mediaUrl: 'https://cdn.example.com/uploads/file.jpg',
      expiresInSeconds: 900,
    };
    saveWhatsAppMediaMock.mockResolvedValue(descriptor);

    const app = await buildApp();
    const response = await request(app)
      .post('/api/whatsapp/uploads')
      .field('fileName', 'custom-name.jpg')
      .field('mimeType', 'image/jpeg')
      .field('ticketId', 'ticket-123')
      .attach('file', Buffer.from('file-content'), {
        filename: 'photo.jpg',
        contentType: 'image/jpeg',
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      mediaUrl: descriptor.mediaUrl,
      mimeType: 'image/jpeg',
      fileName: 'custom-name.jpg',
      size: Buffer.byteLength('file-content'),
      expiresInSeconds: descriptor.expiresInSeconds,
      ticketId: 'ticket-123',
      contactId: null,
    });

    expect(saveWhatsAppMediaMock).toHaveBeenCalledTimes(1);
    expect(saveWhatsAppMediaMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        chatId: 'ticket-123',
        originalName: 'custom-name.jpg',
        mimeType: 'image/jpeg',
      })
    );
    const [[callArgs]] = saveWhatsAppMediaMock.mock.calls;
    expect(Buffer.isBuffer(callArgs.buffer)).toBe(true);
    expect(callArgs.buffer.toString()).toBe('file-content');
  });

  it('rejects uploads without files', async () => {
    const app = await buildApp();

    const response = await request(app).post('/api/whatsapp/uploads');

    expect(response.status).toBe(400);
    expect(response.body?.error?.code).toBe('FILE_REQUIRED');
    expect(saveWhatsAppMediaMock).not.toHaveBeenCalled();
  });

  it('requires authentication', async () => {
    const app = await buildApp({ user: null });

    const response = await request(app)
      .post('/api/whatsapp/uploads')
      .attach('file', Buffer.from('file-content'), 'photo.jpg');

    expect(response.status).toBe(401);
    expect(response.body?.error?.code).toBe('UNAUTHENTICATED');
    expect(saveWhatsAppMediaMock).not.toHaveBeenCalled();
  });
});
