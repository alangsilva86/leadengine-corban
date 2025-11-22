import type { Server } from 'http';

import type { Logger } from '../types/logger';

type ReadinessState = {
  ready: boolean;
  status: 'starting' | 'ready' | 'stopping';
  reason: string;
  since: string;
  lastReadyAt: string | null;
  lastNotReadyAt: string;
  transitions: number;
  metadata: Record<string, unknown>;
};

const nowIso = () => new Date().toISOString();

const state: ReadinessState = {
  ready: false,
  status: 'starting',
  reason: 'booting',
  since: nowIso(),
  lastReadyAt: null,
  lastNotReadyAt: nowIso(),
  transitions: 0,
  metadata: {},
};

const updateState = (partial: Partial<ReadinessState>) => {
  Object.assign(state, partial);
  state.transitions += 1;
};

export const markApplicationNotReady = (reason: string, metadata: Record<string, unknown> = {}) => {
  updateState({
    ready: false,
    status: 'starting',
    reason,
    lastNotReadyAt: nowIso(),
    metadata,
  });
};

export const markApplicationStopping = (reason: string, metadata: Record<string, unknown> = {}) => {
  updateState({
    ready: false,
    status: 'stopping',
    reason,
    lastNotReadyAt: nowIso(),
    metadata,
  });
};

export const markApplicationReady = (reason: string, metadata: Record<string, unknown> = {}) => {
  updateState({
    ready: true,
    status: 'ready',
    reason,
    lastReadyAt: nowIso(),
    metadata,
  });
};

export const getReadinessState = (): ReadinessState => ({ ...state, metadata: { ...state.metadata } });

export const registerGracefulShutdown = (options: {
  logger: Logger;
  server: Server;
  shutdownTimeoutMs?: number;
}) => {
  const { logger, server, shutdownTimeoutMs = 30000 } = options;
  const buildContext = (signal: NodeJS.Signals) => ({
    signal,
    pid: process.pid,
    uptimeSeconds: process.uptime(),
    pm2ProcessId: process.env.pm_id ?? null,
    pm2Home: process.env.PM2_HOME ?? null,
    pnpmExecPath: process.env.npm_execpath ?? null,
    pnpmLifecycle: process.env.npm_lifecycle_event ?? null,
  });

  const shutdownHandler = (signal: NodeJS.Signals) => {
    const context = buildContext(signal);
    markApplicationStopping(`received ${signal}`, context);
    logger.warn('Shutdown signal received. Beginning graceful shutdown.', context);

    const forceExit = setTimeout(() => {
      logger.error('Force exiting after graceful shutdown timeout', { ...context, shutdownTimeoutMs });
      process.exit(1);
    }, shutdownTimeoutMs);

    server.close((error) => {
      clearTimeout(forceExit);
      if (error) {
        logger.error('Error while closing HTTP server during shutdown', { ...context, error });
        process.exit(1);
        return;
      }

      logger.info('HTTP server closed cleanly after shutdown signal', context);
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdownHandler);
  process.on('SIGINT', shutdownHandler);
};

export const logRuntimeLifecycle = (logger: Logger) => {
  const runtimeMetadata = {
    pid: process.pid,
    nodeVersion: process.version,
    pm2ProcessId: process.env.pm_id ?? null,
    pm2Home: process.env.PM2_HOME ?? null,
    pnpmExecPath: process.env.npm_execpath ?? null,
    pnpmLifecycle: process.env.npm_lifecycle_event ?? null,
    containerLimits: {
      memory: process.env.MEMORY_LIMIT ?? null,
      cpuShares: process.env.CPU_SHARES ?? null,
    },
  };

  logger.info('Process lifecycle hooks registered for API runtime', runtimeMetadata);

  process.on('beforeExit', (code) => {
    logger.warn('Process beforeExit triggered', { code, uptimeSeconds: process.uptime() });
  });

  process.on('exit', (code) => {
    logger.warn('Process exit event captured', { code, uptimeSeconds: process.uptime() });
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection detected', { reason });
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception detected', { error });
  });
};
