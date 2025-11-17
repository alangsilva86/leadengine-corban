import { describe, expect, it, beforeEach, vi } from 'vitest';

const processInboundMediaRetryJobsMock = vi.fn<[], Promise<void>>().mockResolvedValue();
const loggerInfoMock = vi.fn();
const loggerErrorMock = vi.fn();

vi.mock('../../workers/media-retry', () => ({
  processInboundMediaRetryJobs: processInboundMediaRetryJobsMock,
}));

vi.mock('../../config/logger', () => ({
  logger: {
    info: loggerInfoMock,
    error: loggerErrorMock,
  },
}));

describe('media-retry CLI scheduler', () => {
  beforeEach(() => {
    processInboundMediaRetryJobsMock.mockClear();
    loggerInfoMock.mockClear();
    loggerErrorMock.mockClear();
  });

  it('executa o worker no intervalo definido e registra os logs principais', async () => {
    const { runMediaRetryWorker } = await import('../media-retry-cron');

    await runMediaRetryWorker({ intervalMs: 0, maxRuns: 2 });

    expect(processInboundMediaRetryJobsMock).toHaveBeenCalledTimes(2);
    expect(loggerInfoMock).toHaveBeenCalledWith(
      '🎯 LeadEngine • CLI :: ♻️ Scheduler de mídia inbound iniciado',
      expect.objectContaining({ intervalMs: 0, maxRuns: 2 }),
    );
    expect(loggerInfoMock).toHaveBeenCalledWith(
      '🎯 LeadEngine • CLI :: 📴 Scheduler finalizado',
      expect.objectContaining({ runs: 2, aborted: false }),
    );
  });

  it('continua executando após falha em um ciclo e reporta o erro', async () => {
    const { runMediaRetryWorker } = await import('../media-retry-cron');

    processInboundMediaRetryJobsMock.mockRejectedValueOnce(new Error('boom'));

    await runMediaRetryWorker({ intervalMs: 0, maxRuns: 2 });

    expect(loggerErrorMock).toHaveBeenCalledWith(
      '🎯 LeadEngine • CLI :: ❌ Falha ao processar ciclo do worker',
      expect.objectContaining({ error: 'boom' }),
    );
    expect(processInboundMediaRetryJobsMock).toHaveBeenCalledTimes(2);
  });
});
