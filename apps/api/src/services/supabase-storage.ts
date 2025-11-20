import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import type { PutObjectCommandInput } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const REQUIRED_ENV_VARS = [
  'S3_ENDPOINT',
  'S3_REGION',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'SUPABASE_BUCKET',
] as const;

type RequiredEnvVar = (typeof REQUIRED_ENV_VARS)[number];

export type SupabaseS3Config = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  maxAttempts: number;
  retryMode: 'adaptive' | 'standard';
};

const resolveEnv = (key: RequiredEnvVar): string => {
  const value = process.env[key];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value.trim();
};

const parseMaxAttempts = (): number => {
  const candidate = process.env.S3_MAX_ATTEMPTS;
  if (!candidate) {
    return 5;
  }

  const parsed = Number.parseInt(candidate, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 5;
  }

  return parsed;
};

let cachedConfig: SupabaseS3Config | null = null;

export const readSupabaseS3Config = (): SupabaseS3Config => {
  if (cachedConfig) {
    return cachedConfig;
  }

  const [endpoint, region, accessKeyId, secretAccessKey, bucket] = REQUIRED_ENV_VARS.map((key) =>
    resolveEnv(key)
  );

  const resolved: SupabaseS3Config = {
    endpoint,
    region,
    bucket,
    accessKeyId,
    secretAccessKey,
    maxAttempts: parseMaxAttempts(),
    retryMode: 'adaptive',
  };

  cachedConfig = resolved;
  return resolved;
};

const resolveS3Client = (() => {
  let client: S3Client | null = null;

  return (): S3Client => {
    if (!client) {
      const config = readSupabaseS3Config();
      client = new S3Client({
        endpoint: config.endpoint,
        region: config.region,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
        forcePathStyle: true,
        maxAttempts: config.maxAttempts,
        retryMode: config.retryMode,
      });
    }

    return client;
  };
})();

type ConnectivityCache = { expiresAt: number; error?: Error | null } | null;

let connectivityCache: ConnectivityCache = null;

const cacheConnectivity = (error: Error | null): void => {
  connectivityCache = {
    expiresAt: Date.now() + (error ? 15_000 : 60_000),
    error,
  };
};

export const validateSupabaseS3Connectivity = async (
  forceRefresh = false
): Promise<void> => {
  if (!forceRefresh && connectivityCache && connectivityCache.expiresAt > Date.now()) {
    if (connectivityCache.error) {
      throw connectivityCache.error;
    }
    return;
  }

  const config = readSupabaseS3Config();
  const client = resolveS3Client();

  try {
    await client.send(new HeadBucketCommand({ Bucket: config.bucket }));
    cacheConnectivity(null);
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : typeof error === 'string'
          ? error
          : 'Unknown error';
    const connectivityError = new Error(
      `Failed to reach Supabase S3 bucket "${config.bucket}" at ${config.endpoint}: ${message}`
    );
    cacheConnectivity(connectivityError);
    throw connectivityError;
  }
};

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
  await validateSupabaseS3Connectivity();

  const client = resolveS3Client();
  const bucket = readSupabaseS3Config().bucket;

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
  await validateSupabaseS3Connectivity();

  const client = resolveS3Client();
  const bucket = readSupabaseS3Config().bucket;

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
};

export const getSupabaseS3Client = (): S3Client => resolveS3Client();
