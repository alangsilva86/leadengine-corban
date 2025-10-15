import { randomUUID } from 'node:crypto';

import { logger } from '../../../config/logger';

const DEFAULT_BUFFER_SIZE = 50;

type DebugLogger = Pick<typeof logger, 'debug' | 'warn'>;

export type WhatsAppDebugPhaseEnvelope = {
  phase: string;
  correlationId?: string | null;
  tenantId?: string | null;
  instanceId?: string | null;
  chatId?: string | null;
  tags?: string[];
  context?: Record<string, unknown>;
  payload?: unknown;
};

export type WhatsAppDebugEvent = WhatsAppDebugPhaseEnvelope & {
  id: string;
  sequence: number;
  emittedAt: string;
};

type WhatsAppDebugSink = (event: WhatsAppDebugEvent) => void;

let debugLogger: DebugLogger = logger;
let enabledOverride: boolean | null = null;
let sequenceCounter = 0;
const sinks = new Set<WhatsAppDebugSink>();
const recentEvents: WhatsAppDebugEvent[] = [];

const pushRecentEvent = (event: WhatsAppDebugEvent): void => {
  recentEvents.push(event);
  if (recentEvents.length > DEFAULT_BUFFER_SIZE) {
    recentEvents.shift();
  }
};

const parseBoolean = (value: string | undefined, defaultValue: boolean): boolean => {
  if (value === undefined || value === null) {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if ([
    '1',
    'true',
    'yes',
    'y',
    'on',
    'enabled',
  ].includes(normalized)) {
    return true;
  }
  if ([
    '0',
    'false',
    'no',
    'n',
    'off',
    'disabled',
  ].includes(normalized)) {
    return false;
  }

  return defaultValue;
};

export const configureWhatsAppDebugLogger = (candidate: DebugLogger | null | undefined): void => {
  debugLogger = candidate ?? logger;
};

export const overrideWhatsAppDebugStreamEnabled = (value: boolean | null): void => {
  enabledOverride = value;
};

export const isWhatsAppDebugStreamEnabled = (): boolean => {
  if (enabledOverride !== null) {
    return enabledOverride;
  }

  return parseBoolean(process.env.WHATSAPP_DEBUG_STREAM_ENABLED, false);
};

export const registerWhatsAppDebugSink = (sink: WhatsAppDebugSink): (() => void) => {
  sinks.add(sink);

  for (const event of recentEvents) {
    try {
      sink(event);
    } catch (error) {
      try {
        debugLogger.warn('whatsapp.debug.sink-initial-replay.failed', {
          error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
        });
      } catch {
        /* ignore secondary logging failure */
      }
      break;
    }
  }

  return () => {
    sinks.delete(sink);
  };
};

export const emitWhatsAppDebugPhase = (envelope: WhatsAppDebugPhaseEnvelope): void => {
  if (!isWhatsAppDebugStreamEnabled()) {
    return;
  }

  sequenceCounter = sequenceCounter >= Number.MAX_SAFE_INTEGER ? 1 : sequenceCounter + 1;
  const event: WhatsAppDebugEvent = {
    id: randomUUID(),
    sequence: sequenceCounter,
    emittedAt: new Date().toISOString(),
    phase: envelope.phase,
    correlationId: envelope.correlationId ?? null,
    tenantId: envelope.tenantId ?? null,
    instanceId: envelope.instanceId ?? null,
    chatId: envelope.chatId ?? null,
    tags: envelope.tags ?? [],
    context: envelope.context ?? {},
    payload: envelope.payload ?? undefined,
  };

  pushRecentEvent(event);

  try {
    debugLogger.debug('whatsapp.debug.phase', event);
  } catch {
    /* ignore logger failures */
  }

  for (const sink of sinks) {
    try {
      sink(event);
    } catch (error) {
      try {
        debugLogger.warn('whatsapp.debug.sink.failed', {
          error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
          phase: event.phase,
          sinkCount: sinks.size,
        });
      } catch {
        /* ignore logger failures */
      }
    }
  }
};

export const getRecentWhatsAppDebugEvents = (): readonly WhatsAppDebugEvent[] => recentEvents.slice();
