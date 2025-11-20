import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendMock = vi.fn();
let createdClientConfig: Record<string, unknown> | null = null;

vi.mock('@aws-sdk/client-s3', () => {
  class MockHeadBucketCommand {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  }

  class MockGetObjectCommand {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  }

  class MockPutObjectCommand {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  }

  class MockS3Client {
    config: Record<string, unknown>;
    send: typeof sendMock;
    constructor(config: Record<string, unknown>) {
      this.config = config;
      this.send = sendMock;
      createdClientConfig = config;
    }
  }

  return {
    HeadBucketCommand: MockHeadBucketCommand,
    GetObjectCommand: MockGetObjectCommand,
    PutObjectCommand: MockPutObjectCommand,
    S3Client: MockS3Client,
  };
});

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://signed.url'),
}));

describe('supabase-storage connectivity', () => {
  beforeEach(() => {
    vi.resetModules();
    sendMock.mockReset();
    createdClientConfig = null;

    process.env.S3_ENDPOINT = 'https://s3.local';
    process.env.S3_REGION = 'sa-east-1';
    process.env.S3_ACCESS_KEY_ID = 'key-id';
    process.env.S3_SECRET_ACCESS_KEY = 'key-secret';
    process.env.SUPABASE_BUCKET = 'leadengine-bucket';
    delete process.env.S3_MAX_ATTEMPTS;
  });

  it('validates environment and caches successful bucket checks', async () => {
    sendMock.mockResolvedValueOnce({});
    const { validateSupabaseS3Connectivity, getSupabaseS3Client } = await import('../supabase-storage');

    await expect(validateSupabaseS3Connectivity()).resolves.toBeUndefined();

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0]?.[0]).toMatchObject({
      input: { Bucket: 'leadengine-bucket' },
    });

    const client = getSupabaseS3Client();
    expect(createdClientConfig).toMatchObject({
      endpoint: 'https://s3.local',
      region: 'sa-east-1',
      forcePathStyle: true,
      maxAttempts: 5,
      retryMode: 'adaptive',
    });

    sendMock.mockClear();
    await validateSupabaseS3Connectivity();
    expect(sendMock).not.toHaveBeenCalled();
    expect(client).toBeDefined();
  });

  it('bubbles up connectivity errors with bucket context and caches failures', async () => {
    const connectivityError = new Error('Forbidden');
    sendMock.mockRejectedValueOnce(connectivityError);
    const { validateSupabaseS3Connectivity } = await import('../supabase-storage');

    await expect(validateSupabaseS3Connectivity(true)).rejects.toThrow(
      'Failed to reach Supabase S3 bucket "leadengine-bucket"'
    );

    sendMock.mockClear();
    await expect(validateSupabaseS3Connectivity()).rejects.toThrow(
      'Failed to reach Supabase S3 bucket "leadengine-bucket"'
    );
    expect(sendMock).not.toHaveBeenCalled();
  });
});
