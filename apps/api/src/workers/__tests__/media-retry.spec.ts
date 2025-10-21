import { beforeEach, describe, expect, it, vi } from 'vitest';

const findPendingJobsMock = vi.hoisted(() => vi.fn());
const markProcessingMock = vi.hoisted(() => vi.fn());
const completeJobMock = vi.hoisted(() => vi.fn());
const rescheduleJobMock = vi.hoisted(() => vi.fn());
const failJobMock = vi.hoisted(() => vi.fn());
const updateMessageMock = vi.hoisted(() => vi.fn());
const downloadMediaMock = vi.hoisted(() => vi.fn());
const saveMediaMock = vi.hoisted(() => vi.fn());
const attemptsCounterMock = vi.hoisted(() => ({ inc: vi.fn() }));
const successCounterMock = vi.hoisted(() => ({ inc: vi.fn() }));
const dlqCounterMock = vi.hoisted(() => ({ inc: vi.fn() }));

vi.mock('@ticketz/storage', () => ({
  findPendingInboundMediaJobs: (...args: unknown[]) => findPendingJobsMock(...args),
  markInboundMediaJobProcessing: (...args: unknown[]) => markProcessingMock(...args),
  completeInboundMediaJob: (...args: unknown[]) => completeJobMock(...args),
  rescheduleInboundMediaJob: (...args: unknown[]) => rescheduleJobMock(...args),
  failInboundMediaJob: (...args: unknown[]) => failJobMock(...args),
  updateMessage: (...args: unknown[]) => updateMessageMock(...args),
}));

vi.mock('../../features/whatsapp-inbound/services/media-downloader', () => ({
  downloadInboundMediaFromBroker: (...args: unknown[]) => downloadMediaMock(...args),
}));

vi.mock('../../services/whatsapp-media-service', () => ({
  saveWhatsAppMedia: (...args: unknown[]) => saveMediaMock(...args),
}));

vi.mock('../../config/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../lib/metrics', () => ({
  inboundMediaRetryAttemptsCounter: attemptsCounterMock,
  inboundMediaRetrySuccessCounter: successCounterMock,
  inboundMediaRetryDlqCounter: dlqCounterMock,
}));

describe('media-retry worker', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.resetModules();
    vi.clearAllMocks();
    findPendingJobsMock.mockReset();
    markProcessingMock.mockReset();
    completeJobMock.mockReset();
    rescheduleJobMock.mockReset();
    failJobMock.mockReset();
    updateMessageMock.mockReset();
    downloadMediaMock.mockReset();
    saveMediaMock.mockReset();
    attemptsCounterMock.inc.mockReset();
    successCounterMock.inc.mockReset();
    dlqCounterMock.inc.mockReset();
  });

  it('downloads media, updates message and completes the job', async () => {
    const job = {
      id: 'job-1',
      tenantId: 'tenant-1',
      messageId: 'message-1',
      messageExternalId: 'external-1',
      instanceId: 'instance-1',
      brokerId: 'broker-1',
      mediaType: 'IMAGE',
      mediaKey: 'key-1',
      directPath: '/direct/path',
      attempts: 1,
      metadata: { fileName: 'original.jpg', mimeType: 'image/jpeg', size: 256 },
    } as const;

    findPendingJobsMock.mockResolvedValueOnce([job]);
    markProcessingMock.mockResolvedValueOnce({ ...job, attempts: 1 });
    downloadMediaMock.mockResolvedValueOnce({
      buffer: Buffer.from('media'),
      mimeType: 'image/jpeg',
      fileName: 'broker.jpg',
      size: 256,
    });
    saveMediaMock.mockResolvedValueOnce({
      mediaUrl: 'https://cdn.example.com/uploads/media.jpg?X-Amz-Signature=test',
      expiresInSeconds: 900,
    });
    updateMessageMock.mockResolvedValueOnce({ id: 'message-1' });

    const { processInboundMediaRetryJobs } = await import('../media-retry');
    await processInboundMediaRetryJobs({ limit: 5, now: new Date('2024-04-05T12:00:00.000Z') });

    expect(findPendingJobsMock).toHaveBeenCalledWith(5, new Date('2024-04-05T12:00:00.000Z'));
    expect(markProcessingMock).toHaveBeenCalledWith('job-1');
    expect(downloadMediaMock).toHaveBeenCalledWith(
      expect.objectContaining({
        brokerId: 'broker-1',
        instanceId: 'instance-1',
        tenantId: 'tenant-1',
        mediaType: 'IMAGE',
        mediaKey: 'key-1',
        directPath: '/direct/path',
        messageId: 'external-1',
      })
    );
    expect(saveMediaMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        originalName: 'original.jpg',
        mimeType: 'image/jpeg',
      })
    );
    expect(updateMessageMock).toHaveBeenCalledWith(
      'tenant-1',
      'message-1',
      expect.objectContaining({
        mediaUrl: 'https://cdn.example.com/uploads/media.jpg?X-Amz-Signature=test',
        mediaFileName: 'original.jpg',
        metadata: expect.objectContaining({
          media_pending: false,
          media: expect.objectContaining({
            urlExpiresInSeconds: 900,
          }),
        }),
      })
    );
    expect(completeJobMock).toHaveBeenCalledWith('job-1');
    expect(attemptsCounterMock.inc).toHaveBeenCalled();
    expect(successCounterMock.inc).toHaveBeenCalled();
    expect(dlqCounterMock.inc).not.toHaveBeenCalled();
  });

  it('reschedules the job with backoff when download fails', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-04-05T12:00:00.000Z'));

    const job = {
      id: 'job-retry',
      tenantId: 'tenant-retry',
      messageId: 'message-retry',
      attempts: 2,
      metadata: {},
    } as const;

    findPendingJobsMock.mockResolvedValueOnce([job]);
    markProcessingMock.mockResolvedValueOnce({ ...job, attempts: 2 });
    downloadMediaMock.mockRejectedValueOnce(new Error('network error'));

    const { processInboundMediaRetryJobs } = await import('../media-retry');
    await processInboundMediaRetryJobs();

    expect(rescheduleJobMock).toHaveBeenCalledTimes(1);
    const [jobId, nextRetryAt] = rescheduleJobMock.mock.calls[0];
    expect(jobId).toBe('job-retry');
    expect(nextRetryAt).toBeInstanceOf(Date);
    expect((nextRetryAt as Date).getTime()).toBeGreaterThan(Date.now());
    expect(failJobMock).not.toHaveBeenCalled();
    expect(successCounterMock.inc).not.toHaveBeenCalled();
    expect(dlqCounterMock.inc).not.toHaveBeenCalled();
  });

  it('sends job to DLQ after max attempts', async () => {
    const job = {
      id: 'job-dlq',
      tenantId: 'tenant-dlq',
      messageId: 'message-dlq',
      attempts: 5,
      metadata: {},
    } as const;

    findPendingJobsMock.mockResolvedValueOnce([job]);
    markProcessingMock.mockResolvedValueOnce({ ...job, attempts: 5 });
    downloadMediaMock.mockRejectedValueOnce(new Error('permanent error'));

    const { processInboundMediaRetryJobs } = await import('../media-retry');
    await processInboundMediaRetryJobs();

    expect(failJobMock).toHaveBeenCalledWith('job-dlq', expect.any(String));
    expect(rescheduleJobMock).not.toHaveBeenCalled();
    expect(dlqCounterMock.inc).toHaveBeenCalled();
  });
});
