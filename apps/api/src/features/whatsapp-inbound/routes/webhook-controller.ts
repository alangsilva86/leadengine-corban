import type { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { Buffer } from 'node:buffer';
import { createHmac, timingSafeEqual } from 'node:crypto';

import { logger } from '../../../config/logger';
import {
  getDefaultInstanceId,
  getWebhookApiKey,
  getWebhookSignatureSecret,
  getWebhookVerifyToken,
} from '../../../config/whatsapp';
import { whatsappWebhookEventsCounter } from '../../../lib/metrics';
import {
  normalizeUpsertEvent,
  type NormalizedRawUpsertMessage,
  type RawBaileysUpsertEvent,
} from '../services/baileys-raw-normalizer';
import { pollChoiceEventBus, type PollChoiceEventBusPayloads, type PollChoiceEventName } from '../services/poll-choice-event-bus';
import { resolveWebhookContext } from '../services/resolve-webhook-context';
import { asArray, normalizeApiKey, readString, unwrapWebhookEvent } from '../utils/webhook-parsers';
import {
  ensureWebhookContext,
  logWebhookEvent,
  trackWebhookRejection,
  type WhatsAppWebhookContext,
} from './context';
import { normalizeContractEvent } from './webhook/normalize-contract-event';
import { processMessagesUpdate } from './webhook/process-messages-update';
import { processNormalizedMessage } from './webhook/process-normalized-message';
import { processPollChoiceEvent } from './webhook/process-poll-choice-event';
import {
  pollVoteTesting,
  resetPollVoteRetryTestingScheduler,
  resetUpdatePollVoteMessageTestingHandler,
  setPollVoteRetryTestingScheduler,
  setUpdatePollVoteMessageTestingHandler,
} from './webhook/poll-vote-message-rewriter';
import { toRawPreview } from './webhook/helpers';

const DEFAULT_VERIFY_RESPONSE = 'LeadEngine WhatsApp webhook';

export type WhatsAppWebhookControllerConfig = {
  ensureWebhookContext: typeof ensureWebhookContext;
  logWebhookEvent: typeof logWebhookEvent;
  trackWebhookRejection: typeof trackWebhookRejection;
};

export type WhatsAppWebhookController = {
  handleWhatsAppWebhook: (req: Request, res: Response) => Promise<void>;
  verifyWhatsAppWebhookRequest: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  webhookRateLimiter: ReturnType<typeof rateLimit>;
  handleVerification: (req: Request, res: Response) => void;
};

const WEBHOOK_RATE_LIMIT_WINDOW_MS = 10_000;
const WEBHOOK_RATE_LIMIT_MAX_REQUESTS = 60;

const createWebhookRateLimiter = (config: WhatsAppWebhookControllerConfig) =>
  rateLimit({
    windowMs: WEBHOOK_RATE_LIMIT_WINDOW_MS,
    max: WEBHOOK_RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: false,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      const context = config.ensureWebhookContext(req, res);
      config.logWebhookEvent('warn', '🛑 WhatsApp webhook rate limit exceeded', context, {
        limit: WEBHOOK_RATE_LIMIT_MAX_REQUESTS,
        windowMs: WEBHOOK_RATE_LIMIT_WINDOW_MS,
      });
      config.trackWebhookRejection('rate_limited');
      res.status(429).end();
    },
  });

const createVerifyWhatsAppWebhookRequest = (config: WhatsAppWebhookControllerConfig) =>
  async (req: Request, res: Response, next: NextFunction) => {
    const context = config.ensureWebhookContext(req, res);
    const expectedApiKey = getWebhookApiKey();
    if (!expectedApiKey) {
      config.trackWebhookRejection('not_configured');
      res.status(503).end();
      return;
    }

    const provided = normalizeApiKey(readString(
      req.header('x-webhook-token'), req.header('x-api-key'), req.header('authorization'),
      req.header('x-authorization')
    ));
    const expected = Buffer.from(expectedApiKey);
    const actual = Buffer.from(provided ?? '');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      config.trackWebhookRejection('invalid_api_key');
      res.status(401).end();
      return;
    }

    if (context.signatureRequired || process.env.NODE_ENV === 'production') {
      const secret = getWebhookSignatureSecret();
      const signature = readString(req.header('x-webhook-signature'), req.header('x-webhook-signature-sha256'),
        req.header('x-signature'), req.header('x-signature-sha256'))?.replace(/^sha256=/i, '');
      if (!secret || !signature || !/^[a-f0-9]{64}$/i.test(signature) || !req.rawBody) {
        config.trackWebhookRejection('invalid_signature');
        res.status(401).json({ ok: false, code: 'INVALID_SIGNATURE' });
        return;
      }
      const signedBody = createHmac('sha256', secret).update(req.rawBody).digest();
      if (!timingSafeEqual(signedBody, Buffer.from(signature, 'hex'))) {
        config.trackWebhookRejection('invalid_signature');
        res.status(401).json({ ok: false, code: 'INVALID_SIGNATURE' });
        return;
      }
    }

    next();
  };

const createHandleWhatsAppWebhook = (config: WhatsAppWebhookControllerConfig) =>
  async (req: Request, res: Response) => {
    const context = config.ensureWebhookContext(req, res);
    const { requestId, signatureRequired } = context;
    const startedAt = Date.now();

    config.logWebhookEvent('info', '🕵️ Etapa1-UPSERT liberada: credenciais verificadas', context, {
      signatureEnforced: signatureRequired,
    });

    const rawBodyParseError = (req as Request & { rawBodyParseError?: SyntaxError | null }).rawBodyParseError;
    if (rawBodyParseError) {
      config.logWebhookEvent('warn', 'WhatsApp webhook received invalid JSON payload', context, {
        error: rawBodyParseError.message,
      });
      whatsappWebhookEventsCounter.inc({
        origin: 'webhook',
        tenantId: 'unknown',
        instanceId: 'unknown',
        result: 'rejected',
        reason: 'invalid_json',
      });
      res.status(400).json({
        ok: false,
        error: { code: 'INVALID_WEBHOOK_JSON', message: 'Invalid JSON payload' },
      });
      return;
    }

    const events = asArray(req.body);
    if (events.length === 0) {
      whatsappWebhookEventsCounter.inc({
        origin: 'webhook',
        tenantId: 'unknown',
        instanceId: 'unknown',
        result: 'accepted',
        reason: 'empty',
      });
      res.status(200).json({ ok: true, received: 0, persisted: 0 });
      return;
    }

    let enqueued = 0;
    let ackPersisted = 0;
    let ackFailures = 0;
    let prepFailures = 0;
    let pollPersisted = 0;
    let pollIgnored = 0;
    let pollFailures = 0;
    let rejectedContexts = 0;

    for (const entry of events) {
      const unwrapped = unwrapWebhookEvent(entry);
      if (!unwrapped) {
        continue;
      }

      const eventRecord = unwrapped.event;
      const envelopeRecord = unwrapped.envelope;
      const rawPreview = toRawPreview(entry);
      const eventType = readString(eventRecord.event, (eventRecord as { type?: unknown }).type);

      const defaultInstanceId = getDefaultInstanceId();
      const resolvedContext = await resolveWebhookContext({
        eventRecord,
        envelopeRecord,
        defaultInstanceId,
        expectedTenantId: readString(req.header('x-tenant-id')),
      });

      if (!resolvedContext.tenantId || !resolvedContext.instanceId) {
        rejectedContexts += 1;
        continue;
      }

      const rawInstanceId = resolvedContext.rawInstanceId ?? undefined;
      const instanceOverride = resolvedContext.instanceId;
      const brokerOverride = resolvedContext.brokerId;
      const tenantOverride = resolvedContext.tenantId;

      if (eventType === 'WHATSAPP_MESSAGES_UPDATE') {
        const ackOutcome = await processMessagesUpdate(eventRecord, envelopeRecord, {
          requestId,
          instanceId: instanceOverride ?? brokerOverride ?? rawInstanceId ?? null,
          tenantOverride: tenantOverride ?? null,
        });

        ackPersisted += ackOutcome.persisted;
        ackFailures += ackOutcome.failures;
        continue;
      }

      if (eventType === 'POLL_CHOICE') {
        const pollOutcome = await processPollChoiceEvent(eventRecord, envelopeRecord, {
          requestId,
          instanceId: instanceOverride ?? brokerOverride ?? rawInstanceId ?? null,
          tenantOverride: tenantOverride ?? null,
        });

        pollPersisted += pollOutcome.persisted;
        pollIgnored += pollOutcome.ignored;
        pollFailures += pollOutcome.failures;
        continue;
      }

      const normalizedMessages: NormalizedRawUpsertMessage[] = [];

      if (eventType === 'MESSAGE_INBOUND' || eventType === 'MESSAGE_OUTBOUND') {
        const normalizedContract = normalizeContractEvent(eventRecord, {
          requestId,
          instanceOverride: instanceOverride ?? null,
          tenantOverride: tenantOverride ?? null,
          brokerOverride: brokerOverride ?? null,
        });

        if (!normalizedContract) {
          whatsappWebhookEventsCounter.inc({
            origin: 'webhook',
            tenantId: tenantOverride ?? 'unknown',
            instanceId: instanceOverride ?? 'unknown',
            result: 'ignored',
            reason: 'invalid_contract',
          });
          continue;
        }

        if (normalizedContract) {
          normalizedMessages.push(normalizedContract);
        }
      } else {
        if (eventType && eventType !== 'WHATSAPP_MESSAGES_UPSERT') {
          whatsappWebhookEventsCounter.inc({
            origin: 'webhook',
            tenantId: tenantOverride ?? 'unknown',
            instanceId: instanceOverride ?? 'unknown',
            result: 'ignored',
            reason: 'unsupported_event',
          });
          continue;
        }

        const normalization = normalizeUpsertEvent(eventRecord, {
          instanceId: instanceOverride ?? null,
          tenantId: tenantOverride ?? null,
          brokerId: brokerOverride ?? null,
        });

        if (normalization.normalized.length === 0) {
          continue;
        }

        normalizedMessages.push(
          ...normalization.normalized.filter(
            (message): message is typeof normalization.normalized[number] =>
              message !== null
          )
        );
      }

      for (const normalized of normalizedMessages) {
        const processed = await processNormalizedMessage({
          normalized,
          eventRecord,
          rawPreview,
          requestId,
          tenantOverride,
          instanceOverride,
        });

        if (processed) {
          enqueued += 1;
        } else {
          prepFailures += 1;
        }
      }
    }

    if (prepFailures > 0) {
      logger.warn('🎯 LeadEngine • WhatsApp :: ⚠️ Webhook encontrou falhas ao preparar ingestão', {
        requestId,
        prepFailures,
      });
    }

    if (ackFailures > 0) {
      logger.warn('🎯 LeadEngine • WhatsApp :: ⚠️ Atualização de status WhatsApp falhou em algumas mensagens', {
        requestId,
        ackFailures,
        ackPersisted,
      });
    }

    logger.debug('🎯 LeadEngine • WhatsApp :: ✅ Eventos enfileirados a partir do webhook', {
      requestId,
      received: events.length,
      enqueued,
      ackPersisted,
      ackFailures,
      pollPersisted,
      pollIgnored,
      pollFailures,
      durationMs: Date.now() - startedAt,
    });

    if (rejectedContexts > 0) {
      config.trackWebhookRejection('invalid_instance_scope');
      res.status(403).end();
      return;
    }
    if (prepFailures > 0 || ackFailures > 0 || pollFailures > 0) {
      res.status(503).setHeader('Retry-After', '5').end();
      return;
    }
    res.status(204).end();
  };

const handleVerificationRequest = (req: Request, res: Response) => {
  const mode = readString(req.query['hub.mode']);
  const challenge = readString(req.query['hub.challenge']);
  const token = readString(req.query['hub.verify_token']);
  const verifyToken = getWebhookVerifyToken();

  if (mode === 'subscribe' && verifyToken && token === verifyToken) {
    res.status(200).send(challenge ?? DEFAULT_VERIFY_RESPONSE);
    return;
  }

  res.status(200).send(DEFAULT_VERIFY_RESPONSE);
};

const subscribeToPollChoiceEvent = <E extends PollChoiceEventName>(
  event: E,
  handler: (payload: PollChoiceEventBusPayloads[E]) => void
) => pollChoiceEventBus.on(event, handler);

type TestingEventHandlerEntry = {
  kind: string;
  handler: (
    eventRecord: RawBaileysUpsertEvent,
    envelope: Record<string, unknown>,
    context: Record<string, unknown>
  ) => unknown | Promise<unknown>;
};

const buildEventHandlerTestingRegistry = () => {
  const registry = new Map<string, TestingEventHandlerEntry>();
  return {
    override(event: string, entry: TestingEventHandlerEntry) {
      registry.set(event, entry);
    },
    resetAll() {
      registry.clear();
    },
    async dispatch(
      event: string,
      eventRecord: RawBaileysUpsertEvent,
      envelope: Record<string, unknown>,
      context: Record<string, unknown>
    ) {
      const handlerEntry = registry.get(event);
      if (!handlerEntry) {
        return { kind: 'unhandled', outcome: null as unknown };
      }
      const outcome = await handlerEntry.handler(eventRecord, envelope, context);
      return { kind: handlerEntry.kind, outcome };
    },
  };
};

const testing = {
  pollVoteUpdaterTesting: pollVoteTesting.pollVoteUpdaterTesting,
  buildPollVoteMessageContent: pollVoteTesting.buildPollVoteMessageContent,
  updatePollVoteMessage: pollVoteTesting.updatePollVoteMessage,
  setUpdatePollVoteMessageHandler: setUpdatePollVoteMessageTestingHandler,
  resetUpdatePollVoteMessageHandler: resetUpdatePollVoteMessageTestingHandler,
  setPollVoteRetryScheduler: setPollVoteRetryTestingScheduler,
  resetPollVoteRetryScheduler: resetPollVoteRetryTestingScheduler,
  subscribeToPollChoiceEvent,
  pollChoice: {
    pollVoteUpdaterTesting: pollVoteTesting.pollVoteUpdaterTesting,
    buildPollVoteMessageContent: pollVoteTesting.buildPollVoteMessageContent,
    updatePollVoteMessage: pollVoteTesting.updatePollVoteMessage,
    setUpdatePollVoteMessageHandler: setUpdatePollVoteMessageTestingHandler,
    resetUpdatePollVoteMessageHandler: resetUpdatePollVoteMessageTestingHandler,
    setPollVoteRetryScheduler: setPollVoteRetryTestingScheduler,
    resetPollVoteRetryScheduler: resetPollVoteRetryTestingScheduler,
    subscribe: subscribeToPollChoiceEvent,
  },
  eventHandlers: buildEventHandlerTestingRegistry(),
};

export const createWhatsAppWebhookController = (
  overrides: Partial<WhatsAppWebhookControllerConfig> = {}
): WhatsAppWebhookController & { __testing: typeof testing } => {
  const config: WhatsAppWebhookControllerConfig = {
    ensureWebhookContext: overrides.ensureWebhookContext ?? ensureWebhookContext,
    logWebhookEvent: overrides.logWebhookEvent ?? logWebhookEvent,
    trackWebhookRejection: overrides.trackWebhookRejection ?? trackWebhookRejection,
  };

  return {
    handleWhatsAppWebhook: createHandleWhatsAppWebhook(config),
    verifyWhatsAppWebhookRequest: createVerifyWhatsAppWebhookRequest(config),
    webhookRateLimiter: createWebhookRateLimiter(config),
    handleVerification: handleVerificationRequest,
    __testing: testing,
  };
};

const defaultController = createWhatsAppWebhookController();

export const handleWhatsAppWebhook = defaultController.handleWhatsAppWebhook;
export const verifyWhatsAppWebhookRequest = defaultController.verifyWhatsAppWebhookRequest;
export const webhookRateLimiter = defaultController.webhookRateLimiter;
export const handleVerification = defaultController.handleVerification;
export const __testing = defaultController.__testing;

export type { WhatsAppWebhookContext };
