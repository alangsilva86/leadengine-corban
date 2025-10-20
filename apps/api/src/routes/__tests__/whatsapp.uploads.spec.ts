import express, { type Request } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const saveWhatsAppMediaMock = vi.fn();

vi.mock('../../services/whatsapp-media-service', () => ({
  saveWhatsAppMedia: (...args: Parameters<typeof saveWhatsAppMediaMock>) => saveWhatsAppMediaMock(...args),
}));

vi.mock('@ticketz/storage', () => ({}));

vi.mock('../../middleware/auth', () => ({
  requireTenant: (req: Request, _res: express.Response, next: express.NextFunction) => {
    req.user = {
      id: 'operator-1',
      tenantId: 'tenant-test',
      email: 'agent@example.com',
      name: 'Agent Smith',
      role: 'AGENT',
      isActive: true,
      permissions: ['tickets:write'],
    };
    next();
  },
}));

describe('POST /api/whatsapp/uploads', () => {
  beforeEach(() => {
    saveWhatsAppMediaMock.mockReset();
    saveWhatsAppMediaMock.mockResolvedValue({
      mediaUrl: 'https://cdn.example.com/uploads/tenant-test-file.jpg',
      mimeType: 'image/jpeg',
      fileName: 'tenant-test-file.jpg',
      size: 1234,
    });
  });

  const buildApp = async () => {
    const app = express();
    const module = await import('../whatsapp');
    app.use('/api/whatsapp', module.whatsappRouter);
    return app;
  };

  it('persists the uploaded buffer and returns media descriptor', async () => {
    const app = await buildApp();

    const response = await request(app)
      .post('/api/whatsapp/uploads')
      .attach('file', Buffer.from('hello world'), { filename: 'greeting.txt', contentType: 'text/plain' });

    expect(response.status).toBe(201);
    expect(response.body?.data).toMatchObject({
      mediaUrl: 'https://cdn.example.com/uploads/tenant-test-file.jpg',
      mimeType: 'image/jpeg',
      fileName: 'tenant-test-file.jpg',
    });

    expect(saveWhatsAppMediaMock).toHaveBeenCalledTimes(1);
    const [payload] = saveWhatsAppMediaMock.mock.calls[0];
    expect(payload).toMatchObject({
      tenantId: 'tenant-test',
      originalName: 'greeting.txt',
      mimeType: 'text/plain',
    });
    expect(Buffer.isBuffer(payload.buffer)).toBe(true);
  });

  it('returns 400 when file is missing', async () => {
    const app = await buildApp();

    const response = await request(app).post('/api/whatsapp/uploads');

    expect(response.status).toBe(400);
    expect(response.body?.error?.code).toBe('FILE_REQUIRED');
    expect(saveWhatsAppMediaMock).not.toHaveBeenCalled();
  });
});
