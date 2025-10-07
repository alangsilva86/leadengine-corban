import { randomUUID } from 'crypto';

export interface MediaStorageOptions {
  mimeType?: string;
  fileName?: string;
  messageId?: string;
}

export interface StoredMedia {
  url: string;
  mimeType?: string;
  fileName?: string;
  size?: number;
  expiresAt?: Date | null;
  storageId: string;
}

/**
 * Stores media content and returns an accessible URL. For now we expose the
 * media as a data URI so consumers can immediately render the media without
 * relying on external object storage. The helper also returns metadata that
 * can be used by higher level services to decide how to handle the media.
 */
export async function storeMedia(
  buffer: Buffer,
  options: MediaStorageOptions = {}
): Promise<StoredMedia> {
  const mimeType = options.mimeType || 'application/octet-stream';
  const storageId = randomUUID();
  const base64 = buffer.toString('base64');

  return {
    url: `data:${mimeType};base64,${base64}`,
    mimeType,
    fileName: options.fileName,
    size: buffer.length,
    expiresAt: null,
    storageId
  };
}
