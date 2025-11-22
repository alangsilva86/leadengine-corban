import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

import { logger } from '../../../config/logger';
import { getWebhookTrustedIps, isWebhookSignatureRequired } from '../../../config/whatsapp';
import { whatsappWebhookEventsCounter } from '../../../lib/metrics';
import { readString as sharedReadString } from '../utils/webhook-parsers';

export type WhatsAppWebhookContext = {
  requestId: string;
  remoteIp: string | null;
  userAgent: string | null;
  signatureRequired: boolean;
  tenantId: string | null;
};

export type WebhookResponseLocals = Record<string, unknown> & {
  whatsappWebhook?: WhatsAppWebhookContext;
};

export const readString = (...candidates: unknown[]): string | null => sharedReadString(...candidates);

export const resolveClientAddress = (req: Request): string => {
  const raw =
    readString(
      req.header('x-real-ip'),
      req.header('x-forwarded-for'),
      req.ip,
      req.socket.remoteAddress ?? null
    ) ?? req.ip ?? 'unknown';

  const first = raw.split(',')[0]?.trim() ?? raw;
  return first || 'unknown';
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
    tenantId: readString((req as Request & { tenantId?: string | null }).tenantId),
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

export type WebhookRejectionReason =
  | 'invalid_api_key'
  | 'invalid_signature'
  | 'rate_limited'
  | 'missing_authorization'
  | 'missing_tenant';

export const trackWebhookRejection = (reason: WebhookRejectionReason) => {
  whatsappWebhookEventsCounter.inc({
    origin: 'webhook',
    tenantId: 'unknown',
    instanceId: 'unknown',
    result: 'rejected',
    reason,
  });
};

const normalizeIp = (value: string): string => {
  let ip = value.trim();
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }
  const lastColon = ip.lastIndexOf(':');
  const hasPort = lastColon > 0 && ip.indexOf(':') === lastColon;
  if (hasPort && ip.includes('.')) {
    ip = ip.substring(0, lastColon);
  }
  return ip;
};

export const isTrustedWebhookIp = (ip: string | null): boolean => {
  if (!ip || ip === 'unknown') {
    return false;
  }
  const normalized = normalizeIp(ip);
  return getWebhookTrustedIps().some((candidate) => normalizeIp(candidate) === normalized);
};
