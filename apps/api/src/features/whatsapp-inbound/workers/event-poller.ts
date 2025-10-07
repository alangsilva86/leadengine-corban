import { setTimeout as delay } from 'node:timers/promises';
import { Prisma } from '@prisma/client';

import { logger } from '../../../config/logger';
import {
  enqueueWhatsAppBrokerEvents,
  getWhatsAppEventQueueStats,
  normalizeWhatsAppBrokerEvent,
  type WhatsAppBrokerEvent,
} from '../queue/event-queue';
import {
  normalizeBrokerEventEnvelope,
  normalizeCursorState,
  type BrokerEventEnvelope,
} from './event-normalizer';
import {
  WhatsAppBrokerNotConfiguredError,
  whatsappBrokerClient,
} from '../../../services/whatsapp-broker-client';
import { prisma } from '../../../lib/prisma';

const SOURCE_KEY = 'whatsapp-broker';
const CURSOR_STATE_KEY = 'whatsapp:event-cursor';
const LAST_ACK_STATE_KEY = 'whatsapp:last-ack';

const FETCH_LIMIT = 50;
const MIN_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 60_000;
const IDLE_DELAY_MS = 5_000;
const DISABLED_BACKOFF_MS = 5 * 60_000;
const PROCESSING_DELAY_MS = 200;
const PROCESSED_EVENT_TTL_MS = 7 * 24 * 60 * 60 * 1_000; // 7 days
const CLEANUP_INTERVAL_MS = 60 * 60 * 1_000; // 1 hour

interface BrokerFetchResponse {
  events?: unknown[];
  items?: unknown[];
  data?: unknown[];
  nextCursor?: unknown;
  nextId?: unknown;
  cursor?: unknown;
  meta?: {
    nextCursor?: unknown;
    cursor?: unknown;
    instanceId?: unknown;
  } | null;
}

interface AckState {
  timestamp: string | null;
  cursor: string | null;
  count: number;
}

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
  backoffMs: MIN_BACKOFF_MS,
};

const toJsonValue = (value: unknown): Prisma.InputJsonValue => {
  if (value === undefined || value === null) {
    return Prisma.JsonNull as unknown as Prisma.InputJsonValue;
  }
  return value as Prisma.InputJsonValue;
};

const parseCursorStateValue = (
  value: Prisma.JsonValue | null | undefined
): { cursor: string | null; instanceId: string | null } => {
  if (value === undefined || value === null) {
    return { cursor: null, instanceId: null };
  }

  return normalizeCursorState(value as unknown);
};

const readStringValue = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  return null;
};

const parseAckState = (value: Prisma.JsonValue | null | undefined): AckState => {
  if (!value || typeof value !== 'object') {
    return { timestamp: null, cursor: null, count: 0 };
  }
  const raw = value as Record<string, unknown>;
  const timestamp = typeof raw.timestamp === 'string' ? raw.timestamp : null;
  const cursor = typeof raw.cursor === 'string' ? raw.cursor : null;
  const count = typeof raw.count === 'number' && Number.isFinite(raw.count) ? raw.count : 0;
  return { timestamp, cursor, count };
};

class WhatsAppEventPoller {
  private running = false;
  private shouldStop = false;
  private cursor: string | null = null;
  private cursorInstanceId: string | null = null;
  private metrics: WhatsAppEventPollerMetrics = { ...defaultMetrics };
  private loopPromise: Promise<void> | null = null;
  private stateLoaded = false;
  private lastCleanupAt = 0;

  start(): void {
    if (this.running) {
      return;
    }

    this.shouldStop = false;
    this.running = true;
    this.metrics.running = true;
    this.loopPromise = this.loop().catch((error) => {
      logger.error('WhatsApp event poller encountered a fatal error', { error });
    });
  }

  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.shouldStop = true;
    this.metrics.running = false;

    if (this.loopPromise) {
      await this.loopPromise;
    }

    this.running = false;
  }

  getMetrics(): WhatsAppEventPollerMetrics {
    return {
      ...this.metrics,
      cursor: this.cursor,
      pendingQueue: getWhatsAppEventQueueStats().pending,
    };
  }

  private async loop(): Promise<void> {
    await this.loadInitialState();

    let backoffMs = MIN_BACKOFF_MS;

    while (!this.shouldStop) {
      try {
        const processed = await this.pollOnce();
        this.metrics.consecutiveFailures = 0;
        this.metrics.lastErrorAt = null;
        this.metrics.lastErrorMessage = null;
        backoffMs = MIN_BACKOFF_MS;
        this.metrics.backoffMs = backoffMs;

        if (processed === 0) {
          await delay(IDLE_DELAY_MS);
        } else {
          await delay(PROCESSING_DELAY_MS);
        }
      } catch (error) {
        this.metrics.consecutiveFailures += 1;
        this.metrics.lastErrorAt = new Date().toISOString();
        this.metrics.lastErrorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('WhatsApp event poller failed to process events', { error });

        if (error instanceof WhatsAppBrokerNotConfiguredError) {
          backoffMs = DISABLED_BACKOFF_MS;
        } else {
          backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
        }
        this.metrics.backoffMs = backoffMs;

        await delay(backoffMs);
      }

      if (this.shouldStop) {
        break;
      }

      if (Date.now() - this.lastCleanupAt > CLEANUP_INTERVAL_MS) {
        await this.cleanupExpiredEvents();
      }
    }
  }

  private async loadInitialState(): Promise<void> {
    if (this.stateLoaded) {
      return;
    }

    this.stateLoaded = true;

    try {
      const [cursorState, ackState] = await prisma.$transaction([
        prisma.integrationState.findUnique({ where: { key: CURSOR_STATE_KEY } }),
        prisma.integrationState.findUnique({ where: { key: LAST_ACK_STATE_KEY } }),
      ]);

      const parsedCursor = parseCursorStateValue(cursorState?.value);
      this.cursor = parsedCursor.cursor;
      this.cursorInstanceId = parsedCursor.instanceId;
      const parsedAck = parseAckState(ackState?.value);

      this.metrics.cursor = this.cursor;
      this.metrics.lastAckAt = parsedAck.timestamp;
      this.metrics.lastAckCursor = parsedAck.cursor;
      this.metrics.lastAckCount = parsedAck.count;
    } catch (error) {
      logger.error('Failed to load WhatsApp poller state', { error });
    }
  }

  private async pollOnce(): Promise<number> {
    logger.debug('🛰️ [Poller] Fetching broker events', {
      cursor: this.cursor,
      instanceId: this.cursorInstanceId,
    });
    const response = await whatsappBrokerClient.fetchEvents<BrokerFetchResponse>({
      limit: FETCH_LIMIT,
      cursor: this.cursor ?? undefined,
      instanceId: this.cursorInstanceId ?? undefined,
    });

    const rawEvents = Array.isArray(response?.events)
      ? response.events
      : Array.isArray(response?.items)
        ? response.items
        : Array.isArray(response?.data)
          ? response.data
          : [];

    this.metrics.lastFetchAt = new Date().toISOString();
    this.metrics.lastFetchCount = rawEvents.length;

    if (rawEvents.length === 0) {
      logger.debug('🛰️ [Poller] Broker returned zero events');
      const cursorSources: unknown[] = [
        response?.nextCursor,
        response?.cursor,
        response?.nextId,
        response?.meta?.nextCursor,
        response?.meta?.cursor,
      ];

      let nextCursorCandidate = { cursor: null as string | null, instanceId: null as string | null };

      for (const source of cursorSources) {
        if (source === undefined || source === null) {
          continue;
        }

        const candidate = normalizeCursorState(source);
        if (candidate.cursor) {
          nextCursorCandidate = candidate;
          break;
        }
      }

      if (!nextCursorCandidate.instanceId && response?.meta?.instanceId !== undefined) {
        const metaInstance = readStringValue(response.meta?.instanceId);
        if (metaInstance) {
          nextCursorCandidate.instanceId = metaInstance;
        }
      }

      if (!nextCursorCandidate.cursor && response && typeof response === 'object') {
        const page = (response as Record<string, unknown>).page;
        if (page && typeof page === 'object') {
          const pageCandidate = normalizeCursorState(
            (page as Record<string, unknown>).nextCursor ??
              (page as Record<string, unknown>).cursor ??
              null
          );
          if (pageCandidate.cursor) {
            nextCursorCandidate = {
              cursor: pageCandidate.cursor,
              instanceId: pageCandidate.instanceId ?? nextCursorCandidate.instanceId,
            };
          }
        }
      }

      await this.persistCursorIfNeeded(nextCursorCandidate.cursor, nextCursorCandidate.instanceId);
      return 0;
    }

    const candidateEvents: WhatsAppBrokerEvent[] = [];
    const ackGroups = new Map<string | null, string[]>();
    const envelopes: BrokerEventEnvelope[] = [];

    for (const raw of rawEvents) {
      const normalizedEnvelope = normalizeBrokerEventEnvelope(raw);
      if (!normalizedEnvelope) {
        logger.warn('Discarding WhatsApp broker event without ack identifier', { record: raw });
        continue;
      }

      envelopes.push(normalizedEnvelope);

      const groupKey = normalizedEnvelope.instanceId ?? null;
      const bucket = ackGroups.get(groupKey);
      if (bucket) {
        bucket.push(normalizedEnvelope.ackId);
      } else {
        ackGroups.set(groupKey, [normalizedEnvelope.ackId]);
      }

      const normalized = normalizeWhatsAppBrokerEvent(normalizedEnvelope.event);
      if (normalized) {
        if (!normalized.cursor && normalizedEnvelope.cursor) {
          normalized.cursor = normalizedEnvelope.cursor;
        }
        if (normalizedEnvelope.instanceId && !normalized.instanceId) {
          normalized.instanceId = normalizedEnvelope.instanceId;
        }
        candidateEvents.push(normalized);
      } else {
        logger.warn('Ignoring unsupported WhatsApp broker event type', { record: normalizedEnvelope.event });
      }
    }

    const totalAckCount = Array.from(ackGroups.values()).reduce((acc, ids) => acc + ids.length, 0);
    if (totalAckCount === 0) {
      return 0;
    }

    const eventIds = candidateEvents.map((event) => event.id);
    const existing = eventIds.length
      ? await prisma.processedIntegrationEvent.findMany({
          where: {
            id: { in: eventIds },
            source: SOURCE_KEY,
          },
          select: { id: true },
        })
      : [];

    const existingIds = new Set(existing.map((item) => item.id));
    const freshEvents = candidateEvents.filter((event) => !existingIds.has(event.id));

    if (freshEvents.length > 0) {
      await prisma.processedIntegrationEvent.createMany({
        data: freshEvents.map((event) => ({
          id: event.id,
          source: SOURCE_KEY,
          cursor: event.cursor ?? this.cursor ?? null,
          payload: toJsonValue(event),
        } satisfies Prisma.ProcessedIntegrationEventCreateManyInput)),
        skipDuplicates: true,
      });

      logger.info('🛰️ [Poller] New events received', {
        count: freshEvents.length,
        eventIds: freshEvents.map((event) => event.id),
      });
      enqueueWhatsAppBrokerEvents(freshEvents);
    }

    for (const [instanceId, ids] of ackGroups) {
      if (!ids.length) {
        continue;
      }

      await whatsappBrokerClient.ackEvents({ ids, instanceId: instanceId ?? undefined });
    }

    const timestamp = new Date().toISOString();
    const nextCursorSources: unknown[] = [
      response?.nextCursor,
      response?.cursor,
      response?.nextId,
      response?.meta?.nextCursor,
      response?.meta?.cursor,
    ];

    let nextCursorCandidate = { cursor: null as string | null, instanceId: null as string | null };

    for (const source of nextCursorSources) {
      if (source === undefined || source === null) {
        continue;
      }

      const candidate = normalizeCursorState(source);
      if (candidate.cursor) {
        nextCursorCandidate = candidate;
        break;
      }
    }

    if (!nextCursorCandidate.instanceId && response?.meta?.instanceId !== undefined) {
      const metaInstance = readStringValue(response.meta?.instanceId);
      if (metaInstance) {
        nextCursorCandidate.instanceId = metaInstance;
      }
    }

    if (!nextCursorCandidate.cursor && response && typeof response === 'object') {
      const page = (response as Record<string, unknown>).page;
      if (page && typeof page === 'object') {
        const pageCandidate = normalizeCursorState(
          (page as Record<string, unknown>).nextCursor ??
            (page as Record<string, unknown>).cursor ??
            null
        );
        if (pageCandidate.cursor) {
          nextCursorCandidate = {
            cursor: pageCandidate.cursor,
            instanceId: pageCandidate.instanceId ?? nextCursorCandidate.instanceId,
          };
        }
      }
    }

    if (!nextCursorCandidate.cursor) {
      for (let index = envelopes.length - 1; index >= 0; index -= 1) {
        const envelope = envelopes[index];
        if (envelope?.cursor) {
          nextCursorCandidate = {
            cursor: envelope.cursor,
            instanceId: envelope.instanceId ?? null,
          };
          break;
        }
      }
    }

    await this.persistAckState({
      timestamp,
      cursor: nextCursorCandidate.cursor,
      count: totalAckCount,
    });

    await this.persistCursorIfNeeded(nextCursorCandidate.cursor, nextCursorCandidate.instanceId);

    this.metrics.lastAckAt = timestamp;
    this.metrics.lastAckCursor = nextCursorCandidate.cursor;
    this.metrics.lastAckCount = totalAckCount;

    return totalAckCount;
  }

  private async persistCursorIfNeeded(
    cursor: string | null,
    instanceId: string | null
  ): Promise<void> {
    const normalizedCursor = cursor && cursor.trim().length > 0 ? cursor.trim() : null;
    const normalizedInstance = instanceId && instanceId.trim().length > 0 ? instanceId.trim() : null;

    if (normalizedCursor === this.cursor && normalizedInstance === this.cursorInstanceId) {
      return;
    }

    await prisma.integrationState.upsert({
      where: { key: CURSOR_STATE_KEY },
      create: {
        key: CURSOR_STATE_KEY,
        value: { cursor: normalizedCursor, instanceId: normalizedInstance },
      },
      update: { value: { cursor: normalizedCursor, instanceId: normalizedInstance } },
    });

    this.cursor = normalizedCursor;
    this.cursorInstanceId = normalizedInstance;
    this.metrics.cursor = normalizedCursor;
  }

  private async persistAckState(state: AckState): Promise<void> {
    await prisma.integrationState.upsert({
      where: { key: LAST_ACK_STATE_KEY },
      create: {
        key: LAST_ACK_STATE_KEY,
        value: {
          timestamp: state.timestamp,
          cursor: state.cursor,
          count: state.count,
        },
      },
      update: {
        value: {
          timestamp: state.timestamp,
          cursor: state.cursor,
          count: state.count,
        },
      },
    });
  }

  private async cleanupExpiredEvents(): Promise<void> {
    try {
      const threshold = new Date(Date.now() - PROCESSED_EVENT_TTL_MS);
      const result = await prisma.processedIntegrationEvent.deleteMany({
        where: {
          source: SOURCE_KEY,
          createdAt: { lt: threshold },
        },
      });
      if (result.count > 0) {
        logger.debug('Cleaned up processed WhatsApp events', { count: result.count });
      }
    } catch (error) {
      logger.warn('Failed to clean up processed WhatsApp events', { error });
    } finally {
      this.lastCleanupAt = Date.now();
    }
  }
}

export const whatsappEventPoller = new WhatsAppEventPoller();

export const getWhatsAppEventPollerMetrics = (): WhatsAppEventPollerMetrics =>
  whatsappEventPoller.getMetrics();
