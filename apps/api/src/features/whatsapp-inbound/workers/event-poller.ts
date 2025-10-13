import { logger } from '../../../config/logger';
import { getWhatsAppMode, isWhatsAppEventPollerDisabled } from '../../../config/whatsapp';
import {
  enqueueWhatsAppBrokerEvents,
  getWhatsAppEventQueueStats,
  normalizeWhatsAppBrokerEvent,
  type WhatsAppBrokerEvent,
} from '../queue/event-queue';
import { normalizeBrokerEventEnvelope, normalizeCursorState } from './event-normalizer';
import { whatsappBrokerClient } from '../../../services/whatsapp-broker-client';
import { loadPollerCursor, savePollerCursor } from './event-poller-state';

export interface WhatsAppEventPollerMetrics {
  running: boolean;
  cursor: string | null;
  pendingQueue: number;
  lastFetchAt: string | null;
  lastFetchCount: number;
  lastAckAt: string | null;
  lastAckCursor: string | null;
  lastAckCount: number;
  consecutiveFailures: number;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  backoffMs: number;
}

const defaultMetrics: WhatsAppEventPollerMetrics = {
  running: false,
  cursor: null,
  pendingQueue: 0,
  lastFetchAt: null,
  lastFetchCount: 0,
  lastAckAt: null,
  lastAckCursor: null,
  lastAckCount: 0,
  consecutiveFailures: 0,
  lastErrorAt: null,
  lastErrorMessage: null,
  backoffMs: 0,
};

const SUCCESS_DELAY_MS = 250;
const IDLE_DELAY_MS = 2000;
const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30_000;
const MAX_BACKOFF_POWER = 5;

interface NormalizedQueueEntry {
  event: WhatsAppBrokerEvent;
  ackCursor: string | null;
}

interface NormalizedFetchResult {
  events: NormalizedQueueEntry[];
  rawCount: number;
  ackCursor: string | null;
  nextCursor: string | null;
  hasMore: boolean;
}

const toTimestamp = (date: Date): string => date.toISOString();

const readBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return false;
    }

    if (['1', 'true', 'yes', 'y', 'enabled', 'more', 'pending'].includes(normalized)) {
      return true;
    }

    if (['0', 'false', 'no', 'n', 'disabled', 'none'].includes(normalized)) {
      return false;
    }
  }

  return false;
};

const nestedKeys = ['pagination', 'pageInfo', 'page_info', 'meta', 'metadata'];

const resolveCursorFromPayload = (
  payload: unknown,
  keys: string[]
): string | null => {
  if (payload === null || payload === undefined) {
    return null;
  }

  const { cursor } = normalizeCursorState(payload);
  if (cursor) {
    return cursor;
  }

  if (typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;

  for (const key of keys) {
    if (key in record) {
      const candidate = normalizeCursorState(record[key]).cursor;
      if (candidate) {
        return candidate;
      }
    }
  }

  for (const key of nestedKeys) {
    if (!(key in record)) {
      continue;
    }

    const candidate = resolveCursorFromPayload(record[key], keys);
    if (candidate) {
      return candidate;
    }
  }

  return null;
};

const resolveHasMore = (payload: unknown): boolean => {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const record = payload as Record<string, unknown>;
  const booleanKeys = ['hasMore', 'has_more', 'more', 'hasNext', 'has_next', 'pending', 'remaining'];

  for (const key of booleanKeys) {
    if (key in record && readBoolean(record[key])) {
      return true;
    }
  }

  for (const key of nestedKeys) {
    if (key in record && resolveHasMore(record[key])) {
      return true;
    }
  }

  return false;
};

const extractEventCandidates = (payload: unknown): unknown[] => {
  if (!payload) {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  if (typeof payload !== 'object') {
    return [];
  }

  const record = payload as Record<string, unknown>;
  const candidateKeys = ['events', 'data', 'items', 'values', 'records', 'entries', 'messages', 'result', 'results'];

  for (const key of candidateKeys) {
    const candidate = record[key];
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  if (record.event || record.id || record.cursor) {
    return [record];
  }

  return [];
};

export class WhatsAppEventPoller {
  private metrics: WhatsAppEventPollerMetrics = { ...defaultMetrics };
  private started = false;
  private stopRequested = false;
  private loopPromise: Promise<void> | null = null;
  private waitHandle: NodeJS.Timeout | null = null;
  private waitResolver: (() => void) | null = null;

  private cancelWait(): void {
    if (this.waitHandle) {
      clearTimeout(this.waitHandle);
      this.waitHandle = null;
    }

    if (this.waitResolver) {
      const resolve = this.waitResolver;
      this.waitResolver = null;
      resolve();
    }
  }

  private async wait(ms: number): Promise<void> {
    if (ms <= 0 || this.stopRequested) {
      return;
    }

    await new Promise<void>((resolve) => {
      this.waitResolver = () => {
        this.waitHandle = null;
        this.waitResolver = null;
        resolve();
      };

      this.waitHandle = setTimeout(() => {
        if (this.waitResolver) {
          this.waitResolver();
        } else {
          resolve();
        }
      }, ms);
    });
  }

  private computeBackoff(): number {
    const failures = Math.max(0, this.metrics.consecutiveFailures - 1);
    const backoff = BASE_BACKOFF_MS * 2 ** Math.min(failures, MAX_BACKOFF_POWER);
    return Math.min(backoff, MAX_BACKOFF_MS);
  }

  private normalizeFetch(payload: unknown): NormalizedFetchResult {
    const eventCandidates = extractEventCandidates(payload);
    const rawCount = eventCandidates.length;
    const normalizedEvents: NormalizedQueueEntry[] = [];

    for (const candidate of eventCandidates) {
      const envelope = normalizeBrokerEventEnvelope(candidate);
      if (!envelope) {
        logger.warn('WhatsApp broker event poller dropped malformed envelope', { candidate });
        continue;
      }

      const normalized = normalizeWhatsAppBrokerEvent(envelope.event);
      if (!normalized) {
        logger.warn('WhatsApp broker event poller dropped event due to unsupported type', {
          eventId: envelope.event.id,
          type: envelope.event.type,
        });
        continue;
      }

      const ackCursor = normalizeCursorState(envelope.cursor ?? normalized.cursor ?? null).cursor;

      normalizedEvents.push({
        event: normalized,
        ackCursor,
      });
    }

    const ackCursor = resolveCursorFromPayload(payload, [
      'ackCursor',
      'ack',
      'lastAckCursor',
      'lastAck',
      'cursor',
    ]);

    const nextCursor = resolveCursorFromPayload(payload, [
      'nextCursor',
      'next',
      'cursor',
      'token',
      'position',
      'offset',
      'after',
    ]);

    const hasMore = resolveHasMore(payload);

    return {
      events: normalizedEvents,
      rawCount,
      ackCursor,
      nextCursor,
      hasMore,
    };
  }

  private async persistCursor(cursor: string | null, ackCount: number): Promise<void> {
    if (!cursor) {
      return;
    }

    await savePollerCursor(cursor);

    const now = toTimestamp(new Date());

    this.metrics.cursor = cursor;
    this.metrics.lastAckCursor = cursor;
    this.metrics.lastAckAt = now;
    this.metrics.lastAckCount = ackCount;
  }

  private async handleIterationError(error: unknown): Promise<void> {
    if (this.stopRequested) {
      return;
    }

    const message = error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown error';

    this.metrics.consecutiveFailures += 1;
    this.metrics.lastErrorAt = toTimestamp(new Date());
    this.metrics.lastErrorMessage = message;

    const backoff = this.computeBackoff();
    this.metrics.backoffMs = backoff;

    logger.error('WhatsApp broker event poller iteration failed', { error: error instanceof Error ? error : { message }, backoff });

    await this.wait(backoff);
  }

  private resetErrorState(): void {
    this.metrics.consecutiveFailures = 0;
    this.metrics.lastErrorAt = null;
    this.metrics.lastErrorMessage = null;
  }

  private async runLoop(initialCursor: string | null): Promise<void> {
    let cursor = initialCursor ?? null;

    while (!this.stopRequested) {
      const pollerDisabled = isWhatsAppEventPollerDisabled();
      const mode = getWhatsAppMode();

      if (pollerDisabled || mode !== 'http') {
        logger.info('WhatsApp broker event poller shutting down due to runtime configuration', {
          pollerDisabled,
          mode,
        });
        this.metrics = {
          ...this.metrics,
          running: false,
          backoffMs: 0,
        };
        this.stopRequested = true;
        break;
      }

      try {
        this.metrics.pendingQueue = getWhatsAppEventQueueStats().pending;
        const fetchStartedAt = new Date();
        const payload = await whatsappBrokerClient.fetchEvents({ cursor: cursor ?? undefined });
        const normalized = this.normalizeFetch(payload);

        this.metrics.lastFetchAt = toTimestamp(fetchStartedAt);
        this.metrics.lastFetchCount = normalized.rawCount;

        if (normalized.events.length > 0) {
          enqueueWhatsAppBrokerEvents(normalized.events.map((entry) => entry.event));
          this.metrics.pendingQueue = getWhatsAppEventQueueStats().pending;

          const ackCursor =
            normalized.events.at(-1)?.ackCursor ?? normalized.ackCursor ?? normalized.nextCursor ?? cursor;

          if (ackCursor && ackCursor !== cursor) {
            try {
              await this.persistCursor(ackCursor, normalized.events.length);
              cursor = ackCursor;
            } catch (error) {
              await this.handleIterationError(error);
              continue;
            }
          } else {
            const now = toTimestamp(new Date());
            this.metrics.lastAckAt = now;
            this.metrics.lastAckCount = normalized.events.length;
          }
        } else {
          const nextCursor = normalized.nextCursor ?? normalized.ackCursor;
          if (nextCursor && nextCursor !== cursor) {
            try {
              await this.persistCursor(nextCursor, 0);
              cursor = nextCursor;
            } catch (error) {
              await this.handleIterationError(error);
              continue;
            }
          }
        }

        this.resetErrorState();

        const delay = normalized.events.length > 0 || normalized.hasMore ? SUCCESS_DELAY_MS : IDLE_DELAY_MS;
        this.metrics.backoffMs = delay;

        await this.wait(delay);
      } catch (error) {
        await this.handleIterationError(error);
      }
    }

    this.started = false;
    this.stopRequested = false;
    this.cancelWait();

    this.metrics = {
      ...this.metrics,
      running: false,
      pendingQueue: getWhatsAppEventQueueStats().pending,
      backoffMs: 0,
    };
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }

    const pollerDisabled = isWhatsAppEventPollerDisabled();
    const mode = getWhatsAppMode();

    this.metrics = {
      ...defaultMetrics,
      running: false,
      cursor: null,
      pendingQueue: getWhatsAppEventQueueStats().pending,
    };

    if (pollerDisabled) {
      logger.info('WhatsApp broker event poller disabled via configuration');
      return;
    }

    if (mode !== 'http') {
      logger.info('WhatsApp broker event poller inactive because WHATSAPP_MODE is not "http"');
      return;
    }

    this.started = true;
    this.stopRequested = false;

    let cursor: string | null = null;

    try {
      cursor = await loadPollerCursor();
    } catch (error) {
      logger.warn('Failed to read persisted WhatsApp poller cursor; starting from scratch', { error });
    }

    this.metrics = {
      ...this.metrics,
      running: true,
      cursor: cursor ?? null,
      lastAckCursor: cursor ?? null,
      pendingQueue: getWhatsAppEventQueueStats().pending,
      backoffMs: 0,
    };

    this.loopPromise = (async () => {
      try {
        await this.runLoop(cursor);
      } catch (error) {
        logger.error('WhatsApp broker event poller terminated unexpectedly', { error });
        await this.handleIterationError(error);
      }
    })();

    logger.info('WhatsApp broker event poller started', { cursor: cursor ?? null });
  }

  async stop(): Promise<void> {
    if (!this.started) {
      return;
    }

    this.stopRequested = true;
    this.cancelWait();

    try {
      await this.loopPromise;
    } catch (error) {
      logger.warn('WhatsApp broker event poller stop encountered errors', { error });
    } finally {
      this.loopPromise = null;
    }

    this.started = false;
    this.stopRequested = false;
    this.cancelWait();

    this.metrics = {
      ...this.metrics,
      running: false,
      pendingQueue: getWhatsAppEventQueueStats().pending,
      backoffMs: 0,
    };

    logger.info('WhatsApp broker event poller stopped.');
  }

  getMetrics(): WhatsAppEventPollerMetrics {
    return { ...this.metrics };
  }
}

export const whatsappEventPoller = new WhatsAppEventPoller();

export const getWhatsAppEventPollerMetrics = (): WhatsAppEventPollerMetrics =>
  whatsappEventPoller.getMetrics();
