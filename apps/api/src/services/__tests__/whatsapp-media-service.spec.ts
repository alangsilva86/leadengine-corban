import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('whatsapp-media-service', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'wa-media-'));
    process.env.WHATSAPP_UPLOADS_DIR = tempDir;
    process.env.WHATSAPP_UPLOADS_BASE_URL = '/static/wa';
    vi.resetModules();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    delete process.env.WHATSAPP_UPLOADS_DIR;
    delete process.env.WHATSAPP_UPLOADS_BASE_URL;
    vi.resetModules();
  });

  it('persists media buffers and returns descriptor metadata', async () => {
    const service = await import('../whatsapp-media-service');
    const buffer = Buffer.from('hello whatsapp');

    const descriptor = await service.saveWhatsAppMedia({
      buffer,
      tenantId: 'Tenant#123',
      originalName: ' Documento .PDF ',
      mimeType: 'application/pdf',
    });

    expect(descriptor.mimeType).toBe('application/pdf');
    expect(descriptor.fileName).toMatch(/tenant-123-.*\.pdf$/);
    expect(descriptor.size).toBe(buffer.length);
    expect(descriptor.mediaUrl).toBe(`/static/wa/${descriptor.fileName}`);

    const stored = await readFile(path.join(service.getWhatsAppUploadsDirectory(), descriptor.fileName));
    expect(stored.equals(buffer)).toBe(true);
  });
});
