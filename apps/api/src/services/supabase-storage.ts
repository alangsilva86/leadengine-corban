import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import type { PutObjectCommandInput } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const resolveEnv = (key: string): string => {
  const value = process.env[key];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value.trim();
};

const resolveS3Client = (() => {
  let client: S3Client | null = null;

  return (): S3Client => {
    if (!client) {
      client = new S3Client({
        endpoint: resolveEnv('S3_ENDPOINT'),
        region: resolveEnv('S3_REGION'),
        credentials: {
          accessKeyId: resolveEnv('S3_ACCESS_KEY_ID'),
          secretAccessKey: resolveEnv('S3_SECRET_ACCESS_KEY'),
        },
        forcePathStyle: true,
      });
    }

    return client;
  };
})();

const resolveBucketName = (): string => resolveEnv('SUPABASE_BUCKET');

export interface UploadObjectInput {
  key: string;
  body: Buffer | Uint8Array | string;
  contentType?: string;
  contentDisposition?: string;
  cacheControl?: string;
  metadata?: PutObjectCommandInput['Metadata'];
}

export const uploadObject = async ({
  key,
  body,
  contentType,
  contentDisposition,
  cacheControl,
  metadata,
}: UploadObjectInput): Promise<void> => {
  const client = resolveS3Client();
  const bucket = resolveBucketName();

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
    ContentDisposition: contentDisposition,
    CacheControl: cacheControl,
    Metadata: metadata,
  });

  await client.send(command);
};

export interface CreateSignedUrlInput {
  key: string;
  expiresInSeconds: number;
}

export const createSignedGetUrl = async ({
  key,
  expiresInSeconds,
}: CreateSignedUrlInput): Promise<string> => {
  const client = resolveS3Client();
  const bucket = resolveBucketName();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
};

export const getSupabaseS3Client = (): S3Client => resolveS3Client();
