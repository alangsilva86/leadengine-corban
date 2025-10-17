import { Router, type Request, type Response } from 'express';
import type { Prisma } from '@prisma/client';

import { asyncHandler } from '../../../middleware/error-handler';
import { prisma } from '../../../lib/prisma';
import { mapPassthroughMessage } from '@ticketz/storage';
import {
  isWhatsAppDebugStreamEnabled,
  registerWhatsAppDebugSink,
  type WhatsAppDebugEvent,
} from '../services/whatsapp-debug-emitter';

export const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
};

export const normalizeJsonRecord = (value: unknown): Record<string, unknown> => {
  const record = asRecord(value);
  return record ? { ...record } : {};
};

const router: Router = Router();

export const normalizeQueryValue = (value: unknown): string | null => {
  if (Array.isArray(value)) {
    return normalizeQueryValue(value[0]);
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const safeStringify = (value: unknown): string => {
  try {
    return JSON.stringify(value, (_key, candidate) => {
      if (typeof candidate === 'bigint') {
        return candidate.toString();
      }
      if (candidate instanceof Date) {
        return candidate.toISOString();
      }
      return candidate;
    });
  } catch (error) {
    return JSON.stringify({
      error: 'serialization_failed',
      message: error instanceof Error ? error.message : String(error),
    });
  }
};

router.get('/debug/wa/stream', (req: Request, res: Response) => {
  if (!isWhatsAppDebugStreamEnabled()) {
    res.status(404).json({
      success: false,
      message: 'WhatsApp debug stream desabilitado.',
    });
    return;
  }

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');

  const flushHeaders = (res as Response & { flushHeaders?: () => void }).flushHeaders;
  if (typeof flushHeaders === 'function') {
    flushHeaders.call(res);
  }

  let closed = false;
  let unsubscribe: () => void = () => undefined;

  const sendEvent = (event: WhatsAppDebugEvent) => {
    if (closed || res.writableEnded) {
      return;
    }

    res.write(`event: whatsapp-debug\n`);
    res.write(`data: ${safeStringify(event)}\n\n`);
  };

  unsubscribe = registerWhatsAppDebugSink(sendEvent);

  const now = new Date().toISOString();
  res.write(`event: whatsapp-debug:init\n`);
  res.write(`data: ${safeStringify({ ok: true, emittedAt: now })}\n\n`);

  const heartbeat = setInterval(() => {
    if (closed || res.writableEnded) {
      return;
    }

    res.write(`: heartbeat ${Date.now()}\n\n`);
  }, 15000);

  const cleanup = () => {
    if (closed) {
      return;
    }
    closed = true;
    clearInterval(heartbeat);
    unsubscribe();
    if (!res.writableEnded) {
      res.end();
    }
  };

  req.on('close', cleanup);
  req.on('end', cleanup);
  req.on('error', cleanup);
});

export const buildWhereClause = (
  tenantId: string | null,
  { chatId, direction }: { chatId: string | null; direction: 'INBOUND' | 'OUTBOUND' | null }
): Prisma.MessageWhereInput => {
  const where: Prisma.MessageWhereInput = {};

  if (tenantId) {
    where.tenantId = tenantId;
  }

  if (direction) {
    where.direction = direction;
  }

  if (chatId) {
    where.OR = [
      { metadata: { path: ['chatId'], string_contains: chatId } },
      { metadata: { path: ['remoteJid'], string_contains: chatId } },
      { metadata: { path: ['passthrough', 'chatId'], string_contains: chatId } },
    ];
  }

  return where;
};

router.get(
  '/debug/messages',
  asyncHandler(async (req: Request, res: Response) => {
    const rawLimit = normalizeQueryValue(req.query.limit);
    const limitCandidate = rawLimit ? Number(rawLimit) : NaN;
    let limit = Number.isFinite(limitCandidate) && limitCandidate > 0 ? Math.floor(limitCandidate) : 50;
    limit = Math.min(Math.max(limit, 1), 200);

    const normalizedDirection = normalizeQueryValue(req.query.direction);
    const directionFilter =
      normalizedDirection && normalizedDirection.toLowerCase() === 'outbound'
        ? 'OUTBOUND'
        : normalizedDirection && normalizedDirection.toLowerCase() === 'inbound'
          ? 'INBOUND'
          : null;

    const chatId = normalizeQueryValue(req.query.chatId);
    const tenantId = normalizeQueryValue(req.query.tenantId);

    const where = buildWhereClause(tenantId, { chatId, direction: directionFilter });

    const records = await prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    type MessageRecord = Awaited<typeof records>[number];
    const payload = records.map((record: MessageRecord) => mapPassthroughMessage(record));

    res.json({
      success: true,
      data: payload,
    });
  })
);

router.get(
  '/debug/baileys-events',
  asyncHandler(async (req: Request, res: Response) => {
    const rawLimit = normalizeQueryValue(req.query.limit);
    const limitCandidate = rawLimit ? Number(rawLimit) : NaN;
    let limit = Number.isFinite(limitCandidate) && limitCandidate > 0 ? Math.floor(limitCandidate) : 50;
    limit = Math.min(Math.max(limit, 1), 200);

    const chatIdFilter = normalizeQueryValue(req.query.chatId);
    const normalizedDirection = normalizeQueryValue(req.query.direction);
    const tenantIdFilter = normalizeQueryValue(req.query.tenantId);
    const directionFilter =
      normalizedDirection && normalizedDirection.toLowerCase() === 'outbound'
        ? 'outbound'
        : normalizedDirection && normalizedDirection.toLowerCase() === 'inbound'
          ? 'inbound'
          : null;

    const events = await prisma.processedIntegrationEvent.findMany({
      where: {
        source: {
          contains: 'baileys',
          mode: 'insensitive',
        },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit * 5, 500),
    });

    type ProcessedEvent = Awaited<typeof events>[number];
    const normalized = events
      .map((event: ProcessedEvent) => {
        const payload = normalizeJsonRecord(event.payload);
        const payloadTenant = typeof payload.tenantId === 'string' ? payload.tenantId : null;
        const direction = typeof payload.direction === 'string' ? payload.direction.toLowerCase() : null;
        const chatId = typeof payload.chatId === 'string' ? payload.chatId : null;

        return {
          id: event.id,
          source: event.source,
          createdAt: event.createdAt,
          tenantId: payloadTenant,
          direction,
          chatId,
          instanceId: typeof payload.instanceId === 'string' ? payload.instanceId : null,
          messageId: typeof payload.messageId === 'string' ? payload.messageId : null,
          payload,
        };
      })
      .filter((entry) => {
        if (tenantIdFilter && entry.tenantId && tenantIdFilter !== entry.tenantId) {
          return false;
        }
        if (directionFilter && entry.direction !== directionFilter) {
          return false;
        }
        if (chatIdFilter && entry.chatId && !entry.chatId.includes(chatIdFilter)) {
          return false;
        }
        return true;
      })
      .slice(0, limit);

    res.json({
      success: true,
      data: normalized,
    });
  })
);

export { router as debugMessagesRouter };
