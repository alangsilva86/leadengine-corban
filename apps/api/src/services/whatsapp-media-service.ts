import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_UPLOADS_DIR = path.resolve(process.cwd(), 'uploads/whatsapp');
const DEFAULT_BASE_URL = '/uploads/whatsapp';

const mimeExtensionMap = new Map(
  Object.entries({
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'video/mp4': '.mp4',
    'video/mpeg': '.mpeg',
    'video/quicktime': '.mov',
    'audio/mpeg': '.mp3',
    'audio/ogg': '.ogg',
    'audio/wav': '.wav',
    'application/pdf': '.pdf',
  })
);

const resolveUploadsDir = (): string => {
  const configured = process.env.WHATSAPP_UPLOADS_DIR;
  if (configured && configured.trim().length > 0) {
    return path.resolve(configured.trim());
  }
  return DEFAULT_UPLOADS_DIR;
};

const resolveBaseUrl = (): string => {
  const configured = process.env.WHATSAPP_UPLOADS_BASE_URL;
  if (configured && configured.trim().length > 0) {
    return configured.trim().replace(/\/$/, '');
  }
  return DEFAULT_BASE_URL;
};

let ensuredPath: string | null = null;
let ensurePromise: Promise<string> | null = null;

export const ensureWhatsAppUploadsDirectory = async (): Promise<string> => {
  const directory = resolveUploadsDir();
  if (!ensurePromise || ensuredPath !== directory) {
    ensurePromise = mkdir(directory, { recursive: true }).then(() => directory);
    ensuredPath = directory;
  }

  return ensurePromise;
};

const sanitizeSegment = (value: string | undefined | null): string => {
  if (!value) {
    return 'tenant';
  }
  return value.toString().toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'tenant';
};

const resolveExtension = (originalName?: string, mimeType?: string): string => {
  if (originalName) {
    const normalizedName = originalName.trim();
    if (normalizedName.length > 0) {
      const ext = path.extname(normalizedName).toLowerCase().trim();
      if (ext) {
        return ext;
      }
    }
  }

  if (mimeType) {
    const normalized = mimeType.toLowerCase().trim();
    const mapped = mimeExtensionMap.get(normalized);
    if (mapped) {
      return mapped;
    }

    if (normalized.startsWith('image/')) {
      return `.${normalized.split('/')[1] ?? 'img'}`;
    }
    if (normalized.startsWith('video/')) {
      return `.${normalized.split('/')[1] ?? 'mp4'}`;
    }
    if (normalized.startsWith('audio/')) {
      return `.${normalized.split('/')[1] ?? 'audio'}`;
    }
  }

  return '.bin';
};

export const getWhatsAppUploadsDirectory = (): string => resolveUploadsDir();

export const getWhatsAppUploadsBaseUrl = (): string => resolveBaseUrl();

export const buildWhatsAppMediaUrl = (fileName: string): string => {
  const baseUrl = resolveBaseUrl();
  if (/^https?:\/\//i.test(baseUrl)) {
    return `${baseUrl}/${fileName}`;
  }
  const normalizedBase = baseUrl.startsWith('/') ? baseUrl : `/${baseUrl}`;
  return `${normalizedBase}/${fileName}`;
};

export interface SaveWhatsAppMediaInput {
  buffer: Buffer;
  tenantId?: string;
  originalName?: string;
  mimeType?: string;
}

export interface WhatsAppMediaDescriptor {
  mediaUrl: string;
  mimeType: string;
  fileName: string;
  size: number;
}

export const saveWhatsAppMedia = async ({
  buffer,
  tenantId,
  originalName,
  mimeType,
}: SaveWhatsAppMediaInput): Promise<WhatsAppMediaDescriptor> => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('Arquivo inválido para upload.');
  }

  const directory = await ensureWhatsAppUploadsDirectory();
  const safeTenant = sanitizeSegment(tenantId);
  const extension = resolveExtension(originalName, mimeType);
  const fileName = `${safeTenant}-${randomUUID()}${extension}`;
  const targetPath = path.join(directory, fileName);

  await writeFile(targetPath, buffer);

  const resolvedMime = mimeType && mimeType.trim().length > 0 ? mimeType : 'application/octet-stream';

  return {
    mediaUrl: buildWhatsAppMediaUrl(fileName),
    mimeType: resolvedMime,
    fileName,
    size: buffer.length,
  };
};

export default saveWhatsAppMedia;
