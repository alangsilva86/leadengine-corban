import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { logger } from '../config/logger';
import { processInboundMediaRetryJobs } from '../workers/media-retry';

const DEFAULT_INTERVAL_MS = 60_000;

const readIntervalMs = (value?: number): number => {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return value;
  }

  const envValue = Number(process.env.MEDIA_RETRY_WORKER_INTERVAL_MS);
  if (Number.isFinite(envValue) && envValue >= 0) {
    return envValue;
  }

  return DEFAULT_INTERVAL_MS;
};

const readMaxRuns = (value?: number): number => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }

  const envValue = Number(process.env.MEDIA_RETRY_WORKER_MAX_RUNS);
  if (Number.isFinite(envValue) && envValue > 0) {
    return envValue;
  }

  return Number.POSITIVE_INFINITY;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface RunMediaRetryWorkerOptions {
  intervalMs?: number;
  maxRuns?: number;
  signal?: AbortSignal;
}

export const runMediaRetryWorker = async (options: RunMediaRetryWorkerOptions = {}): Promise<void> => {
  const intervalMs = readIntervalMs(options.intervalMs);
  const maxRuns = readMaxRuns(options.maxRuns);
  const signal = options.signal;

  let aborted = signal?.aborted ?? false;
  if (signal && !signal.aborted) {
    signal.addEventListener(
      'abort',
      () => {
        aborted = true;
      },
      { once: true },
    );
  }

  logger.info('🎯 LeadEngine • CLI :: ♻️ Scheduler de mídia inbound iniciado', {
    intervalMs,
    maxRuns: Number.isFinite(maxRuns) ? maxRuns : null,
  });

  let runs = 0;
  while (!aborted && runs < maxRuns) {
    try {
      await processInboundMediaRetryJobs();
      logger.info('🎯 LeadEngine • CLI :: ✅ Ciclo do worker concluído', { runs: runs + 1 });
    } catch (error) {
      logger.error('🎯 LeadEngine • CLI :: ❌ Falha ao processar ciclo do worker', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    runs += 1;

    if (aborted || runs >= maxRuns) {
      break;
    }

    await delay(intervalMs);
  }

  logger.info('🎯 LeadEngine • CLI :: 📴 Scheduler finalizado', {
    runs,
    aborted,
  });
};

const isDirectExecution = (): boolean => {
  if (!process.argv[1]) {
    return false;
  }

  const currentFilePath = fileURLToPath(import.meta.url);
  return path.resolve(currentFilePath) === path.resolve(process.argv[1]);
};

if (isDirectExecution()) {
  const controller = new AbortController();
  process.once('SIGINT', () => controller.abort());
  process.once('SIGTERM', () => controller.abort());

  runMediaRetryWorker({ signal: controller.signal }).catch((error) => {
    logger.error('🎯 LeadEngine • CLI :: ❌ Erro fatal na execução do worker', {
      error: error instanceof Error ? error.stack ?? error.message : String(error),
    });
    process.exitCode = 1;
  });
}
