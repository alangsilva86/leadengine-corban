import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

import { logger } from '../../../config/logger';
import { isWebhookSignatureRequired } from '../../../config/whatsapp';
import { whatsappWebhookEventsCounter } from '../../../lib/metrics';

export type WhatsAppWebhookContext = {
  requestId: string;
  remoteIp: string | null;
  userAgent: string | null;
  signatureRequired: boolean;
};

export type WebhookResponseLocals = Record<string, unknown> & {
  whatsappWebhook?: WhatsAppWebhookContext;
};

export const readString = (...candidates: unknown[]): string | null => {
  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }
  return null;
};

export const resolveClientAddress = (req: Request): string => {
  return (
    readString(
      req.header('x-real-ip'),
      req.header('x-forwarded-for'),
      req.ip,
      req.socket.remoteAddress ?? null
    ) ?? req.ip ?? 'unknown'
  );
};

export const ensureWebhookContext = (req: Request, res: Response): WhatsAppWebhookContext => {
  const locals = res.locals as WebhookResponseLocals;
  if (locals.whatsappWebhook) {
    return locals.whatsappWebhook;
  }

  const requestId = readString(req.rid, req.header('x-request-id'), req.header('x-correlation-id')) ?? randomUUID();
  const remoteIp = resolveClientAddress(req);
  const userAgent = readString(req.header('user-agent'), req.header('x-user-agent'));

  const context: WhatsAppWebhookContext = {
    requestId,
    remoteIp,
    userAgent,
    signatureRequired: isWebhookSignatureRequired(),
  };

  locals.whatsappWebhook = context;
  return context;
};

export type WebhookLogLevel = 'info' | 'warn' | 'error' | 'debug';

export const logWebhookEvent = (
  level: WebhookLogLevel,
  message: string,
  context: WhatsAppWebhookContext,
  extra?: Record<string, unknown>
) => {
  logger[level](message, {
    requestId: context.requestId,
    remoteIp: context.remoteIp ?? 'unknown',
    userAgent: context.userAgent ?? 'unknown',
    ...extra,
  });
};

export type WebhookRejectionReason = 'invalid_api_key' | 'invalid_signature' | 'rate_limited';

export const trackWebhookRejection = (reason: WebhookRejectionReason) => {
  whatsappWebhookEventsCounter.inc({
    origin: 'webhook',
    tenantId: 'unknown',
    instanceId: 'unknown',
    result: 'rejected',
    reason,
  });
};
