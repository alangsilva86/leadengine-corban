import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { Prisma } from '@prisma/client';

import { asyncHandler } from '../../../middleware/error-handler';
import { logger } from '../../../config/logger';
import { maskDocument, maskPhone } from '../../../lib/pii';
import { enqueueWhatsAppBrokerEvents } from '../queue/event-queue';
import { whatsappWebhookEventsCounter } from '../../../lib/metrics';
import { isWhatsappRawFallbackEnabled, isWhatsappPassthroughModeEnabled } from '../../../config/feature-flags';
import {
  normalizeUpsertEvent,
  type RawBaileysUpsertEvent,
} from '../services/baileys-raw-normalizer';
import { resolveWhatsappInstanceByIdentifiers } from '../services/instance-resolver';
import {
  BrokerInboundEvent,
  BrokerWebhookInboundSchema,
  type BrokerWebhookInbound,
} from '../schemas/broker-contracts';
import { prisma } from '../../../lib/prisma';

const webhookRouter: Router = Router();
const integrationWebhookRouter: Router = Router();

const PASSTHROUGH_TENANT_FALLBACK = 'demo-tenant';

const getWebhookApiKey = (): string => {
  const explicitKey = (process.env.WHATSAPP_WEBHOOK_API_KEY || '').trim();
  if (explicitKey.length > 0) {
    return explicitKey;
  }

  return (process.env.WHATSAPP_BROKER_API_KEY || '').trim();
};

const getWebhookSignatureSecret = (): string => {
  const explicitSecret = (process.env.WHATSAPP_WEBHOOK_SIGNATURE_SECRET || '').trim();
  if (explicitSecret.length > 0) {
    return explicitSecret;
  }

  return getWebhookApiKey();
};

const safeCompare = (a: string, b: string): boolean => {
  if (!a || !b) {
    return false;
  }

  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);

  if (bufferA.length !== bufferB.length) {
    return false;
  }

  try {
    return timingSafeEqual(bufferA, bufferB);
  } catch (error) {
    logger.warn('Failed to safely compare secrets', { error });
    return false;
  }
};

const readRawBodyParseError = (req: Request): SyntaxError | null => {
  const candidate = (req as Request & { rawBodyParseError?: SyntaxError | null }).rawBodyParseError;
  return candidate ?? null;
};

const verifyWebhookSignature = (signature: string | null, rawBody: Buffer | undefined): boolean => {
  if (!signature) {
    return true;
  }

  const secret = getWebhookSignatureSecret();
  if (!secret) {
    logger.warn('WhatsApp webhook signature received but no secret configured');
    return true;
  }

  if (!rawBody) {
    logger.warn('WhatsApp webhook signature received but raw body is unavailable');
    return false;
  }

  try {
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const provided = signature.trim().toLowerCase();
    const normalizedExpected = expected.toLowerCase();

    const providedBuffer = Buffer.from(provided, 'hex');
    const expectedBuffer = Buffer.from(normalizedExpected, 'hex');

    const providedIsValidHex = providedBuffer.length > 0 && providedBuffer.length * 2 === provided.length;
    const expectedIsValidHex = expectedBuffer.length > 0 && expectedBuffer.length * 2 === normalizedExpected.length;

    if (!providedIsValidHex || !expectedIsValidHex) {
      return false;
    }

    if (providedBuffer.length !== expectedBuffer.length) {
      return false;
    }

    try {
      return timingSafeEqual(providedBuffer, expectedBuffer);
    } catch (error) {
      logger.warn('Failed to safely compare webhook signatures', { error });
      return false;
    }
  } catch (error) {
    logger.warn('Failed to verify WhatsApp webhook signature', { error });
    return false;
  }
};

const asRecord = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
};

const normalizeStringArray = (value: unknown): string[] | null => {
  if (!value) {
    return null;
  }

  const items = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  const seen = new Set<string>();
  const normalized: string[] = [];

  items.forEach((entry) => {
    if (typeof entry !== 'string') {
      return;
    }
    const trimmed = entry.trim();
    if (!trimmed || seen.has(trimmed)) {
      return;
    }
    seen.add(trimmed);
    normalized.push(trimmed);
  });

  return normalized.length > 0 ? normalized : null;
};

const toE164Phone = (remoteJid: string | null): string | null => {
  if (!remoteJid) {
    return null;
  }
  const digits = remoteJid.replace(/[^0-9]/g, '');
  if (digits.length < 8) {
    return null;
  }
  const sanitized = digits.replace(/^0+/, '');
  return sanitized.length > 0 ? `+${sanitized}` : null;
};

const sanitizeJsonPayload = (value: unknown): Prisma.InputJsonValue => {
  try {
    return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
  } catch {
    return null;
  }
};

const logBaileysDebugEvent = async (
  source: string,
  payload: unknown
): Promise<void> => {
  try {
    await prisma.processedIntegrationEvent.create({
      data: {
        id: randomUUID(),
        source,
        payload: sanitizeJsonPayload(payload),
      },
    });
  } catch (error) {
    logger.warn('⚠️ [Webhook] Falha ao registrar payload para debug', {
      source,
      error,
    });
  }
};

const ensurePassthroughInstance = async (
  tenantId: string,
  instanceId: string
): Promise<{ instanceId: string; tenantId: string; brokerId: string }> => {
  const effectiveTenant = tenantId?.trim().length ? tenantId.trim() : PASSTHROUGH_TENANT_FALLBACK;
  const effectiveInstance = instanceId.trim();
  const friendlyName = `Baileys ${effectiveInstance.slice(0, 8)}`;

  const record = await prisma.whatsAppInstance.upsert({
    where: { id: effectiveInstance },
    update: {},
    create: {
      id: effectiveInstance,
      tenantId: effectiveTenant,
      name: friendlyName,
      brokerId: effectiveInstance,
      status: 'connected',
      connected: true,
      metadata: {
        autoprov: true,
        source: 'passthrough',
        createdAt: new Date().toISOString(),
      },
    },
  });

  return {
    instanceId: record.id,
    tenantId: record.tenantId,
    brokerId: record.brokerId,
  };
};

const toRegistrationsTuple = (
  registrations: string[] | null
): [string, ...string[]] | null => {
  if (!registrations || registrations.length === 0) {
    return null;
  }

  const [first, ...rest] = registrations;
  return [first, ...rest];
};

const compactObject = <T extends Record<string, unknown>>(value: T): T => {
  return Object.fromEntries(
    Object.entries(value).filter(([, candidate]) => candidate !== undefined)
  ) as T;
};

const readString = (...candidates: unknown[]): string | null => {
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

const normalizeRemoteJid = (input: unknown): string | null => {
  if (typeof input !== 'string') {
    return null;
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const withoutDomain = trimmed.replace(/@.+$/u, '');
  const digitsOnly = withoutDomain.replace(/\D+/gu, '');

  if (digitsOnly.length >= 8) {
    return digitsOnly;
  }

  return withoutDomain || null;
};

const inboundTypeAliases = new Set([
  'MESSAGE_INBOUND',
  'INBOUND_MESSAGE',
  'MESSAGE_RECEIVED',
  'MESSAGE_RECEIVE',
  'MESSAGE_INCOMING',
  'INCOMING_MESSAGE',
]);

const normalizeInboundType = (value: unknown): 'message' | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const canonical = trimmed.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
  if (inboundTypeAliases.has(canonical)) {
    return 'message';
  }

  return null;
};

const normalizeMessageDirection = (value: unknown): 'inbound' | 'outbound' | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (['inbound', 'incoming', 'received', 'receive', 'in'].includes(normalized)) {
    return 'inbound';
  }

  if (['outbound', 'sent', 'sending', 'out'].includes(normalized)) {
    return 'outbound';
  }

  return null;
};

type ModernWebhookNormalization = 'standard' | 'type-alias' | 'direction-alias';

const tryParseModernWebhookEvent = (
  entry: Record<string, unknown>,
  context: { index: number }
): { data: BrokerWebhookInbound; normalization: ModernWebhookNormalization } | null => {
  const parsed = BrokerWebhookInboundSchema.safeParse(entry);
  if (parsed.success) {
    return { data: parsed.data, normalization: 'standard' };
  }

  const normalizedType = normalizeInboundType(entry.type);
  const normalizedDirection = normalizeMessageDirection(entry.direction);

  if (!normalizedType && !normalizedDirection) {
    return null;
  }

  const candidate: Record<string, unknown> = { ...entry };
  let normalization: ModernWebhookNormalization | null = null;

  if (normalizedType) {
    candidate.event = 'message';
    candidate.direction = normalizedDirection ?? 'inbound';
    normalization = 'type-alias';
  } else if (normalizedDirection) {
    candidate.direction = normalizedDirection;
    normalization = 'direction-alias';
  }

  const fallback = BrokerWebhookInboundSchema.safeParse(candidate);
  if (!fallback.success || !normalization) {
    logger.warn('🛑 [Webhook] Falha ao normalizar evento inbound via alias', {
      index: context.index,
      type: typeof entry.type === 'string' ? entry.type : null,
      direction: typeof entry.direction === 'string' ? entry.direction : null,
      issues: fallback.success ? [] : fallback.error.issues,
    });
    return null;
  }

  if (normalization === 'type-alias') {
    logger.debug('📥 [Webhook] Evento inbound aceito via alias de tipo', {
      index: context.index,
      originalType: typeof entry.type === 'string' ? entry.type : null,
      instanceId: fallback.data.instanceId,
    });
  } else {
    logger.debug('📥 [Webhook] Evento inbound aceito via alias de direção', {
      index: context.index,
      originalDirection: typeof entry.direction === 'string' ? entry.direction : null,
      instanceId: fallback.data.instanceId,
    });
  }

  return { data: fallback.data, normalization };
};

const buildInboundEvent = (
  parsed: BrokerWebhookInbound,
  context: {
    index: number;
    messageIndex?: number;
    tenantId?: string;
    sessionId?: string;
    requestId: string;
    receivedAt?: string;
  }
): BrokerInboundEvent => {
  const { instanceId, timestamp, message, from, metadata } = parsed;
  const direction =
    parsed.direction === 'outbound' ? 'OUTBOUND' : parsed.direction === 'inbound' ? 'INBOUND' : 'INBOUND';
  const eventType = direction === 'OUTBOUND' ? 'MESSAGE_OUTBOUND' : 'MESSAGE_INBOUND';
  const rawMessage = { ...asRecord(message) };
  const rawMetadata = asRecord(metadata);

  const messageId =
    (typeof rawMessage.id === 'string' && rawMessage.id.trim().length > 0
      ? rawMessage.id.trim()
      : null) ?? randomUUID();

  const rawName = typeof from.name === 'string' ? from.name.trim() : null;
  const rawPushName = typeof from.pushName === 'string' ? from.pushName.trim() : null;
  const displayName =
    rawName && rawName.length > 0
      ? rawName
      : rawPushName && rawPushName.length > 0
      ? rawPushName
      : null;

  const registrationsArray = normalizeStringArray(from.registrations);
  const contact = {
    phone: typeof from.phone === 'string' ? from.phone : null,
    name: displayName,
    document: typeof from.document === 'string' ? from.document : null,
    registrations: toRegistrationsTuple(registrationsArray),
    avatarUrl: typeof from.avatarUrl === 'string' ? from.avatarUrl : null,
    pushName: rawPushName,
  };

  const normalizedTimestamp = (() => {
    if (timestamp) {
      return timestamp;
    }
    const numericTs = typeof rawMetadata.timestamp === 'number' ? rawMetadata.timestamp : null;
    if (numericTs && Number.isFinite(numericTs)) {
      const ms = numericTs > 1_000_000_000_000 ? numericTs : numericTs * 1000;
      try {
        return new Date(ms).toISOString();
      } catch (error) {
        logger.debug('⚠️ [Webhook] Falha ao normalizar timestamp numérico', {
          error,
          numericTs,
          index: context.index,
          messageIndex: context.messageIndex ?? null,
        });
      }
    }
    return null;
  })();

  const receivedAt = context.receivedAt ?? new Date().toISOString();
  const rawMessageKey = asRecord(rawMessage.key);
  const rawChatId = readString(
    rawMessage.chatId,
    rawMessage.chatID,
    rawMessage.chat_id,
    rawMessage.remoteJid,
    rawMessageKey?.remoteJid,
    rawMetadata.chatId
  );
  if (rawChatId && typeof rawMessage.chatId !== 'string') {
    rawMessage.chatId = rawChatId;
  }
  const remoteJid = readString(rawMessageKey?.remoteJid, rawMessage.remoteJid, rawChatId);
  const normalizedRemote = normalizeRemoteJid(remoteJid ?? undefined);
  const phoneE164 = toE164Phone(normalizedRemote ?? remoteJid ?? null);

  const metadataEnvelope = {
    ...rawMetadata,
    direction,
    tenantId: context.tenantId ?? (typeof rawMetadata.tenantId === 'string' ? rawMetadata.tenantId : undefined),
    instanceId,
    requestId:
      typeof rawMetadata.requestId === 'string' && rawMetadata.requestId.trim().length > 0
        ? rawMetadata.requestId
        : context.requestId,
    receivedAt:
      typeof rawMetadata.receivedAt === 'string' && rawMetadata.receivedAt.trim().length > 0
        ? rawMetadata.receivedAt
        : receivedAt,
  };
  const brokerMetadata =
    metadataEnvelope && typeof metadataEnvelope === 'object' && metadataEnvelope !== null
      ? (metadataEnvelope as Record<string, unknown>).broker
      : undefined;
  if (brokerMetadata && typeof brokerMetadata === 'object') {
    (metadataEnvelope as Record<string, unknown>).broker = {
      ...(brokerMetadata as Record<string, unknown>),
      direction,
      instanceId,
    };
  } else {
    (metadataEnvelope as Record<string, unknown>).broker = {
      direction,
      instanceId,
    };
  }

  (metadataEnvelope as Record<string, unknown>).sourceInstance = instanceId;
  if (rawChatId) {
    (metadataEnvelope as Record<string, unknown>).chatId = rawChatId;
  }
  if (remoteJid) {
    (metadataEnvelope as Record<string, unknown>).remoteJid = remoteJid;
  }
  if (phoneE164) {
    (metadataEnvelope as Record<string, unknown>).phoneE164 = phoneE164;
  }
  if (displayName) {
    (metadataEnvelope as Record<string, unknown>).displayName = displayName;
  }

  return {
    id: messageId,
    type: eventType,
    tenantId: context.tenantId,
    sessionId: context.sessionId,
    instanceId,
    timestamp: normalizedTimestamp,
    cursor: null,
    payload: {
      instanceId,
      timestamp: normalizedTimestamp,
      direction,
      contact,
      message: rawMessage,
      metadata: metadataEnvelope,
    },
  };
};

const normalizeHeaderSecret = (value: string | undefined | null): string | null => {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const readAuthorizationToken = (value: string | undefined | null): string | null => {
  const normalized = normalizeHeaderSecret(value);
  if (!normalized) {
    return null;
  }

  const bearerMatch = /^Bearer\s+(.+)$/iu.exec(normalized);
  if (bearerMatch) {
    const [, token] = bearerMatch;
    const trimmedToken = token.trim();
    return trimmedToken.length > 0 ? trimmedToken : null;
  }

  // Legacy integrations may send the token directly without the Bearer prefix.
  if (!normalized.includes(' ')) {
    return normalized;
  }

  return null;
};

const readWebhookSecretFromHeaders = (req: Request): string | null => {
  const providedApiKey = normalizeHeaderSecret(req.header('x-api-key'));
  if (providedApiKey) {
    return providedApiKey;
  }

  const legacyAuthorizationHeaders: Array<string | undefined> = [
    req.header('authorization'),
    req.header('x-authorization'),
  ];

  for (const headerValue of legacyAuthorizationHeaders) {
    const token = readAuthorizationToken(headerValue);
    if (token) {
      return token;
    }
  }

  return null;
};

const handleWhatsAppWebhook = async (req: Request, res: Response) => {
  const providedApiKey = readWebhookSecretFromHeaders(req) ?? '';
  const expectedApiKey = getWebhookApiKey();
  const requestId = readString(req.header('x-request-id')) ?? randomUUID();
  const passthroughMode = isWhatsappPassthroughModeEnabled();
  const headerTenantId = readString(req.header('x-tenant-id'));
  const fallbackTenantId = headerTenantId ?? (passthroughMode ? PASSTHROUGH_TENANT_FALLBACK : undefined);

  logger.info('📥 [Webhook] Requisição recebida', {
    requestId,
    ip: req.ip ?? null,
    userAgent: req.header('user-agent') ?? null,
    contentLength: req.header('content-length') ?? null,
    route: req.originalUrl,
  });

  if (!expectedApiKey || !safeCompare(providedApiKey, expectedApiKey)) {
    logger.warn('WhatsApp webhook rejected due to invalid API key', { requestId });
    whatsappWebhookEventsCounter.inc({ result: 'rejected', reason: 'invalid_api_key' });
    res.status(401).json({ ok: false });
    return;
  }

  const parseError = readRawBodyParseError(req);
  if (parseError) {
    logger.warn('WhatsApp webhook rejected due to invalid JSON payload', { error: parseError.message });
    whatsappWebhookEventsCounter.inc({ result: 'rejected', reason: 'invalid_json' });
    res.status(400).json({
      ok: false,
      error: {
        code: 'INVALID_WEBHOOK_JSON',
        message: 'Body is not valid JSON.',
      },
    });
    return;
  }

  const signatureHeader = req.header('x-signature-sha256');
  if (!verifyWebhookSignature(signatureHeader ?? null, req.rawBody)) {
    logger.warn('WhatsApp webhook rejected due to invalid signature');
    whatsappWebhookEventsCounter.inc({ result: 'rejected', reason: 'invalid_signature' });
    res.status(401).json({ ok: false });
    return;
  }

  const payload = req.body ?? {};
  const receivedAtIso = new Date().toISOString();

  const asArray = (input: unknown): Record<string, unknown>[] => {
    if (!input) return [];
    if (Array.isArray(input)) {
      return input.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'));
    }
    if (typeof input === 'object') {
      const candidate = input as Record<string, unknown>;
      if (Array.isArray(candidate.events)) {
        return candidate.events.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'));
      }
      return [candidate];
    }
    return [];
  };

  const rawEvents = asArray(payload);

type NormalizedCandidate = {
  data: BrokerWebhookInbound;
  sourceIndex: number;
  messageIndex?: number;
  tenantId?: string;
  sessionId?: string;
};

const isRawBaileysEvent = (entry: Record<string, unknown>): boolean => {
  const event = readString(entry.event);
  return event === 'WHATSAPP_MESSAGES_UPSERT' || event === 'WHATSAPP_MESSAGES_UPDATE';
};

  const normalizedCandidates: NormalizedCandidate[] = [];

  for (let index = 0; index < rawEvents.length; index += 1) {
    const entry = rawEvents[index];

    if (isRawBaileysEvent(entry)) {
      logger.info('📥 [Webhook] Evento Baileys bruto recebido', {
        index,
        event: entry.event,
        iid: entry.iid ?? null,
      });

      const rawFallbackEnabled = passthroughMode || isWhatsappRawFallbackEnabled();
      if (!rawFallbackEnabled) {
        whatsappWebhookEventsCounter.inc({ result: 'accepted', reason: 'raw_baileys_event' });
        continue;
      }

      const entryRecord = entry as Record<string, unknown>;
      const payloadRecord = asRecord(entryRecord.payload) ?? {};

      let resolvedInstance = await resolveWhatsappInstanceByIdentifiers([
        entryRecord.instanceId,
        entryRecord.iid,
        payloadRecord?.instanceId,
        payloadRecord?.iid,
        payloadRecord?.brokerId,
      ]);

      if (!resolvedInstance && passthroughMode) {
        const candidateInstanceId = readString(
          entryRecord.instanceId,
          entryRecord.iid,
          payloadRecord?.instanceId,
          payloadRecord?.iid,
          payloadRecord?.brokerId
        );
        const tenantForInstance = fallbackTenantId ?? PASSTHROUGH_TENANT_FALLBACK;

        if (candidateInstanceId) {
          try {
            resolvedInstance = await ensurePassthroughInstance(tenantForInstance, candidateInstanceId);
            logger.info('🎯 [Webhook] Instância Baileys autoprovicionada (passthrough)', {
              requestId,
              tenantId: tenantForInstance,
              instanceId: candidateInstanceId,
            });
          } catch (error) {
            logger.error('🛑 [Webhook] Falha ao autoprovicionar instância em modo passthrough', {
              requestId,
              tenantId: tenantForInstance,
              instanceId: candidateInstanceId,
              error,
            });
          }
        }
      }

      if (!resolvedInstance) {
        logger.warn('📭 [Webhook] Instância Baileys desconhecida — evento ignorado', {
          index,
          iid: entryRecord.iid ?? null,
          instanceId: entryRecord.instanceId ?? null,
        });
        whatsappWebhookEventsCounter.inc({ result: 'ignored', reason: 'unknown_instance' });
        continue;
      }

      const normalization = normalizeUpsertEvent(entry as RawBaileysUpsertEvent, {
        instanceId: resolvedInstance.instanceId,
        tenantId: resolvedInstance.tenantId,
        brokerId: resolvedInstance.brokerId,
        sessionId: resolvedInstance.brokerId,
      });

      if (normalization.ignored.length > 0) {
        whatsappWebhookEventsCounter.inc(
          { result: 'ignored', reason: 'raw_inbound_ignored' },
          normalization.ignored.length
        );
        normalization.ignored.forEach((ignored) => {
          logger.debug('📭 [Webhook] Mensagem Baileys ignorada pelo fallback', {
            index,
            messageIndex: ignored.messageIndex,
            reason: ignored.reason,
            details: ignored.details ?? null,
          });
        });
      }

      if (normalization.normalized.length === 0) {
        logger.debug('📭 [Webhook] Nenhuma mensagem elegível após normalização Baileys', {
          index,
        });
        continue;
      }

      whatsappWebhookEventsCounter.inc(
        { result: 'accepted', reason: 'raw_inbound_normalized' },
        normalization.normalized.length
      );

      normalization.normalized.forEach((normalized) => {
        const effectiveTenantId =
          normalized.tenantId ?? resolvedInstance?.tenantId ?? fallbackTenantId ?? null;
        const effectiveSessionId = normalized.sessionId ?? resolvedInstance?.brokerId ?? null;
        const messageDirection = normalized.data.direction === 'outbound' ? 'outbound' : 'inbound';
        logger.info('📬 [Webhook] Evento inbound derivado de Baileys normalizado', {
          index,
          messageIndex: normalized.messageIndex,
          messageId: normalized.messageId,
          messageType: normalized.messageType,
          direction: messageDirection,
          instanceId: normalized.data.instanceId,
          tenantId: effectiveTenantId,
          isGroup: normalized.isGroup,
          brokerId: normalized.brokerId ?? resolvedInstance?.brokerId ?? null,
        });

        normalizedCandidates.push({
          data: normalized.data,
          sourceIndex: index,
          messageIndex: normalized.messageIndex,
          tenantId: effectiveTenantId ?? undefined,
          sessionId: effectiveSessionId ?? undefined,
        });
      });

      continue;
    }

    const modern = tryParseModernWebhookEvent(entry, { index });
    if (modern) {
      const tenantIdHeader =
        typeof entry.tenantId === 'string' && entry.tenantId.trim().length > 0
          ? entry.tenantId.trim()
          : undefined;
      const sessionId =
        typeof entry.sessionId === 'string' && entry.sessionId.trim().length > 0
          ? entry.sessionId.trim()
          : undefined;
      const effectiveTenantId = tenantIdHeader ?? fallbackTenantId ?? undefined;

      if (passthroughMode) {
        try {
          await ensurePassthroughInstance(effectiveTenantId ?? PASSTHROUGH_TENANT_FALLBACK, modern.data.instanceId);
        } catch (error) {
          logger.error('🛑 [Webhook] Falha ao autoprovicionar instância para envelope MESSAGE_*', {
            requestId,
            tenantId: effectiveTenantId ?? null,
            instanceId: modern.data.instanceId,
            error,
          });
        }
      }

      normalizedCandidates.push({
        data: modern.data,
        sourceIndex: index,
        tenantId: effectiveTenantId,
        sessionId,
      });
      continue;
    }

    const parseAttempt = BrokerWebhookInboundSchema.safeParse(entry);
    logger.warn('🛑 [Webhook] Evento ignorado: payload inválido', {
      index,
      issues: parseAttempt.success ? [] : parseAttempt.error.issues,
    });
  }

  const normalizedEvents: BrokerInboundEvent[] = normalizedCandidates.map((candidate) =>
    buildInboundEvent(candidate.data, {
      index: candidate.sourceIndex,
      messageIndex: candidate.messageIndex,
      tenantId: candidate.tenantId,
      sessionId: candidate.sessionId,
      requestId,
      receivedAt: receivedAtIso,
    })
  );

  const queued = normalizedEvents.length;

  if (queued === 0) {
    logger.debug('📭 [Webhook] Nenhum evento de mensagem elegível encontrado', {
      received: rawEvents.length,
    });
    return res.status(204).send();
  }

  const baileysLogPromises: Array<Promise<void>> = [];

  normalizedEvents.forEach((event, eventIndex) => {
    logger.info('📬 [Webhook] Evento de mensagem normalizado', {
      requestId,
      eventId: event.id,
      instanceId: event.instanceId,
      direction: event.payload.direction ?? null,
      hasMessage: Boolean(event.payload.message),
      hasContact: Boolean(event.payload.contact?.phone || event.payload.contact?.name),
    });
    const metadataRecord = asRecord(event.payload.metadata) ?? {};
    const messageRecord = asRecord(event.payload.message) ?? {};
    const messageId =
      (typeof messageRecord.id === 'string' && messageRecord.id.trim().length > 0
        ? messageRecord.id.trim()
        : event.id) ?? null;
    const chatId =
      (typeof messageRecord.chatId === 'string' && messageRecord.chatId.trim().length > 0
        ? messageRecord.chatId.trim()
        : typeof metadataRecord.chatId === 'string'
        ? metadataRecord.chatId
        : null) ?? null;
    const remoteJid =
      (typeof metadataRecord.remoteJid === 'string' && metadataRecord.remoteJid.trim().length > 0
        ? metadataRecord.remoteJid.trim()
        : typeof messageRecord.remoteJid === 'string'
        ? messageRecord.remoteJid.trim()
        : null) ?? null;
    const phone =
      (typeof metadataRecord.phoneE164 === 'string' && metadataRecord.phoneE164.trim().length > 0
        ? metadataRecord.phoneE164.trim()
        : null) ?? null;

    logger.info('🎯 [Webhook] WhatsApp mensagem enfileirada', {
      tenantId: event.tenantId ?? fallbackTenantId ?? null,
      iid: event.instanceId,
      direction: event.payload.direction ?? null,
      externalId: messageId,
      chatId,
      remoteJid,
      phone,
    });

    const sourceValue = typeof metadataRecord.source === 'string' ? metadataRecord.source : null;
    if (!sourceValue || !sourceValue.includes('baileys')) {
      return;
    }

    const candidate = normalizedCandidates[eventIndex];
    const rawEvent = candidate ? rawEvents[candidate.sourceIndex] : undefined;

    baileysLogPromises.push(
      logBaileysDebugEvent(sourceValue, {
        requestId,
        tenantId: event.tenantId ?? fallbackTenantId ?? null,
        instanceId: event.instanceId ?? null,
        direction: event.payload.direction ?? null,
        chatId,
        messageId,
        metadata: metadataRecord,
        message: event.payload.message ?? null,
        raw: rawEvent ?? null,
        receivedAt: metadataRecord.receivedAt ?? receivedAtIso,
      })
    );
  });

  if (baileysLogPromises.length > 0) {
    await Promise.allSettled(baileysLogPromises);
  }

  enqueueWhatsAppBrokerEvents(
    normalizedEvents.map((event) => ({
      id: event.id,
      type: event.type,
      tenantId: event.tenantId,
      sessionId: event.sessionId,
      instanceId: event.instanceId,
      timestamp: event.timestamp ?? undefined,
      payload: event.payload,
    }))
  );

  whatsappWebhookEventsCounter.inc({ result: 'accepted', reason: 'ok' }, queued);

  logger.info('WhatsApp webhook processed', {
    received: rawEvents.length,
    queued,
    requestId,
    phones: normalizedEvents.map((event) => maskPhone(event.payload.contact.phone)),
    documents: normalizedEvents.map((event) => maskDocument(event.payload.contact.document ?? null)),
  });

  res.status(204).send();
};

webhookRouter.post('/whatsapp', asyncHandler(handleWhatsAppWebhook));
integrationWebhookRouter.post('/whatsapp/webhook', asyncHandler(handleWhatsAppWebhook));

webhookRouter.get(
  '/whatsapp',
  asyncHandler(async (req: Request, res: Response) => {
    const mode = typeof req.query['hub.mode'] === 'string' ? req.query['hub.mode'] : undefined;
    const token =
      typeof req.query['hub.verify_token'] === 'string' ? req.query['hub.verify_token'] : undefined;
    const challenge =
      typeof req.query['hub.challenge'] === 'string' ? req.query['hub.challenge'] : undefined;

    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'your-verify-token';

    if (mode === 'subscribe' && token === verifyToken) {
      logger.info('WhatsApp webhook verified');
      res.status(200).send(challenge ?? '');
    } else {
      logger.warn('WhatsApp webhook verification failed');
      res.status(403).send('Forbidden');
    }
  })
);

export { integrationWebhookRouter as whatsappIntegrationWebhookRouter, webhookRouter as whatsappWebhookRouter };

export const __testing = {
  normalizeRemoteJid,
  buildInboundEvent,
};
