import { setTimeout as delay } from 'node:timers/promises';
import type { Prisma } from '@prisma/client';

import { logger } from '../config/logger';
import {
  enqueueWhatsAppBrokerEvents,
  getWhatsAppEventQueueStats,
  normalizeWhatsAppBrokerEvent,
  type WhatsAppBrokerEvent,
} from './whatsapp-event-queue';
import {
  WhatsAppBrokerNotConfiguredError,
  whatsappBrokerClient,
} from '../services/whatsapp-broker-client';
import { prisma } from '../lib/prisma';

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
  items?: unknown[];
  events?: unknown[];
  nextCursor?: string | null;
  ack?: unknown;
  ackAt?: string | null;
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
    return Prisma.JsonNull;
  }
  return value as Prisma.InputJsonValue;
};

const parseCursorState = (value: Prisma.JsonValue | null | undefined): string | null => {
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    return value.trim().length > 0 ? value.trim() : null;
  }
  if (typeof value === 'object' && value !== null && 'cursor' in value) {
    const rawCursor = (value as Record<string, unknown>).cursor;
    if (typeof rawCursor === 'string' && rawCursor.trim().length > 0) {
      return rawCursor.trim();
    }
    if (rawCursor === null) {
      return null;
    }
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

const extractAckIds = (value: unknown): string[] => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : null))
      .filter((item): item is string => Boolean(item && item.length > 0));
  }

  if (typeof value === 'object') {
    const candidate = (value as Record<string, unknown>).ids;
    if (Array.isArray(candidate)) {
      return candidate
        .map((item) => (typeof item === 'string' ? item.trim() : null))
        .filter((item): item is string => Boolean(item && item.length > 0));
    }
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return [value.trim()];
  }

  return [];
};

class WhatsAppEventPoller {
  private running = false;
  private shouldStop = false;
  private cursor: string | null = null;
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

      this.cursor = parseCursorState(cursorState?.value);
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
    const response = await whatsappBrokerClient.fetchEvents<BrokerFetchResponse>({
      limit: FETCH_LIMIT,
      after: this.cursor ?? undefined,
    });

    const rawEvents = Array.isArray(response?.items)
      ? response.items
      : Array.isArray(response?.events)
      ? response.events
      : [];

    this.metrics.lastFetchAt = new Date().toISOString();
    this.metrics.lastFetchCount = rawEvents.length;

    if (rawEvents.length === 0) {
      await this.persistCursorIfNeeded(response?.nextCursor ?? null);
      return 0;
    }

    const eventIds: string[] = [];
    const candidateEvents: WhatsAppBrokerEvent[] = [];

    for (const raw of rawEvents) {
      if (!raw || typeof raw !== 'object') {
        continue;
      }

      const record = raw as Record<string, unknown>;
      const id = typeof record.id === 'string' && record.id.trim().length > 0 ? record.id.trim() : null;
      if (!id) {
        logger.warn('Discarding WhatsApp broker event without id', { record });
        continue;
      }

      eventIds.push(id);

      const normalized = normalizeWhatsAppBrokerEvent(record);
      if (normalized) {
        candidateEvents.push(normalized);
      } else {
        logger.warn('Ignoring unsupported WhatsApp broker event type', { record });
      }
    }

    if (!eventIds.length) {
      return 0;
    }

    const existing = await prisma.processedIntegrationEvent.findMany({
      where: {
        id: { in: eventIds },
        source: SOURCE_KEY,
      },
      select: { id: true },
    });

    const existingIds = new Set(existing.map((item) => item.id));
    const freshEvents = candidateEvents.filter((event) => !existingIds.has(event.id));

    if (freshEvents.length > 0) {
      await prisma.processedIntegrationEvent.createMany({
        data: freshEvents.map((event) => ({
          id: event.id,
          source: SOURCE_KEY,
          type: event.type,
          cursor: event.cursor ?? this.cursor ?? null,
          metadata: toJsonValue(event.payload ?? null),
          expiresAt: new Date(Date.now() + PROCESSED_EVENT_TTL_MS),
        } satisfies Prisma.ProcessedIntegrationEventCreateManyInput)),
        skipDuplicates: true,
      });

      enqueueWhatsAppBrokerEvents(freshEvents);
    }

    const ackTokens = extractAckIds(response?.ack);
    const idsToAck = ackTokens.length > 0 ? ackTokens : eventIds;
    if (!idsToAck.length) {
      return 0;
    }

    await whatsappBrokerClient.ackEvents(idsToAck);

    const timestamp = typeof response?.ackAt === 'string' ? response.ackAt : new Date().toISOString();
    const nextCursor = typeof response?.nextCursor === 'string' ? response.nextCursor : null;

    await this.persistAckState({
      timestamp,
      cursor: nextCursor,
      count: idsToAck.length,
    });

    await this.persistCursorIfNeeded(nextCursor);

    this.metrics.lastAckAt = timestamp;
    this.metrics.lastAckCursor = nextCursor;
    this.metrics.lastAckCount = idsToAck.length;

    return idsToAck.length;
  }

  private async persistCursorIfNeeded(cursor: string | null): Promise<void> {
    const normalized = cursor && cursor.trim().length > 0 ? cursor.trim() : null;
    if (normalized === this.cursor) {
      return;
    }

    await prisma.integrationState.upsert({
      where: { key: CURSOR_STATE_KEY },
      create: { key: CURSOR_STATE_KEY, value: { cursor: normalized } },
      update: { value: { cursor: normalized } },
    });

    this.cursor = normalized;
    this.metrics.cursor = normalized;
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
          OR: [
            { expiresAt: { lt: new Date() } },
            { processedAt: { lt: threshold } },
          ],
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
