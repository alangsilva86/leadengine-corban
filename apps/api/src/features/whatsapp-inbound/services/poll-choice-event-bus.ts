import type { ZodIssue } from 'zod';

import { logger } from '../../../config/logger';
import type { SchedulePollInboxFallbackResult } from './poll-choice-pipeline';
<<<<<<< HEAD
=======
import { whatsappWebhookEventsCounter } from '../../../lib/metrics';
import {
  PollChoiceInboxNotificationStatus,
  triggerPollChoiceInboxNotification,
} from './poll-choice-inbox-service';
import type {
  PollChoiceEventPayload,
  PollChoiceSelectedOptionPayload,
} from '../schemas/poll-choice';
import type { PollChoiceState } from '../schemas/poll-choice';
import type { PersistPollChoiceVoteResult, SchedulePollInboxFallbackResult } from './poll-choice-pipeline';
>>>>>>> main

export type PollChoiceEventOutcome = 'accepted' | 'ignored' | 'failed';

export type PollChoiceEventBusPayloads = {
  pollChoiceInvalid: {
    requestId: string;
    reason: 'missing_payload' | 'schema_error';
    issues?: ZodIssue[];
    preview: string | null;
    tenantId: string | null;
    instanceId: string | null;
  };
  pollChoiceDuplicateEvent: {
    requestId: string;
    pollId: string;
    tenantId: string | null;
    instanceId: string | null;
  };
  pollChoiceDuplicateVote: {
    requestId: string;
    pollId: string;
    tenantId: string | null;
    instanceId: string | null;
  };
  pollChoiceRewriteMissingTenant: {
    requestId: string;
    pollId: string;
    voterJid: string;
    candidates: string[];
    delayMs: number;
  };
  pollChoiceRewriteRetryScheduled: {
    requestId: string;
    pollId: string;
    voterJid: string;
    delayMs: number;
  };
  pollChoiceTenantLookupFailed: {
    requestId: string;
    pollId: string;
    error: unknown;
  };
  pollChoiceMetadataSyncFailed: {
    requestId: string;
    pollId: string;
    error: unknown;
  };
  pollChoiceInboxMissingTenant: {
    requestId: string;
    pollId: string;
    voterJid: string;
  };
  pollChoiceInboxDecision: {
    requestId: string;
    decision: SchedulePollInboxFallbackResult;
  };
  pollChoiceInboxFailed: {
    requestId: string;
    pollId: string;
    tenantId: string;
    reason: string;
    error?: unknown;
  };
  pollChoiceError: {
    requestId: string;
    pollId: string;
    tenantId: string | null;
    instanceId: string | null;
    error: unknown;
  };
  pollChoiceCompleted: {
    requestId: string;
    pollId: string | null;
    tenantId: string | null;
    instanceId: string | null;
    outcome: PollChoiceEventOutcome;
    reason: string;
    extra?: Record<string, unknown>;
  };
};

export type PollChoiceEventName = keyof PollChoiceEventBusPayloads;

export type PollChoiceEventBus = {
  emit: <E extends PollChoiceEventName>(event: E, payload: PollChoiceEventBusPayloads[E]) => void;
  on: <E extends PollChoiceEventName>(
    event: E,
    handler: (payload: PollChoiceEventBusPayloads[E]) => void
  ) => () => void;
};

export const createPollChoiceEventBus = (): PollChoiceEventBus => {
  const registry = new Map<
    PollChoiceEventName,
    Set<(payload: PollChoiceEventBusPayloads[PollChoiceEventName]) => void>
  >();
<<<<<<< HEAD
=======
const createPollChoiceEventBus = (): PollChoiceEventBus => {
  const registry = new Map<PollChoiceEventName, Set<(payload: PollChoiceEventBusPayloads[PollChoiceEventName]) => void>>();
>>>>>>> main

  return {
    emit(event, payload) {
      const handlers = registry.get(event);
      if (!handlers) {
        return;
      }

      for (const handler of handlers) {
        try {
          handler(payload as never);
        } catch (error) {
          logger.error('pollChoiceEventHandlerFailed', { event, error });
        }
      }
    },
    on(event, handler) {
      const existing = registry.get(event) ?? new Set();
      existing.add(handler as never);
      registry.set(event, existing as never);

      return () => {
        const handlers = registry.get(event);
        if (!handlers) {
          return;
        }
        handlers.delete(handler as never);
        if (handlers.size === 0) {
          registry.delete(event);
        }
      };
    },
  };
};

export const pollChoiceEventBus = createPollChoiceEventBus();

pollChoiceEventBus.on('pollChoiceInvalid', ({ reason, requestId, issues, preview }) => {
  const message =
    reason === 'missing_payload'
      ? 'Received poll choice event without payload'
      : 'Received invalid poll choice payload';

  logger.warn(message, {
    requestId,
    ...(reason === 'schema_error' ? { issues } : {}),
    rawPreview: preview,
  });
});

pollChoiceEventBus.on('pollChoiceDuplicateEvent', ({ pollId, requestId }) => {
  logger.debug('Duplicate poll choice event ignored', { requestId, pollId });
});

pollChoiceEventBus.on('pollChoiceDuplicateVote', ({ pollId, requestId }) => {
  logger.info('Ignoring poll choice vote because it is already up-to-date', {
    requestId,
    pollId,
  });
});

pollChoiceEventBus.on(
  'pollChoiceRewriteMissingTenant',
  ({ requestId, pollId, voterJid, candidates, delayMs }) => {
    logger.info('rewrite.poll_vote.retry_missing_tenant', {
      requestId,
      pollId,
      voterJid,
      messageId: candidates.at(0) ?? null,
      delayMs,
    });
  }
);

pollChoiceEventBus.on('pollChoiceRewriteRetryScheduled', ({ requestId, pollId, voterJid, delayMs }) => {
  logger.info('rewrite.poll_vote.retry_scheduled', {
    requestId,
    pollId,
    voterJid,
    delayMs,
  });
});

pollChoiceEventBus.on('pollChoiceTenantLookupFailed', ({ requestId, pollId, error }) => {
  logger.warn('Failed to load poll metadata while resolving tenant', {
    requestId,
    pollId,
    error,
  });
});

pollChoiceEventBus.on('pollChoiceMetadataSyncFailed', ({ requestId, pollId, error }) => {
  logger.error('Failed to sync poll choice state with message metadata', {
    requestId,
    pollId,
    error,
  });
});

pollChoiceEventBus.on('pollChoiceInboxMissingTenant', ({ requestId, pollId, voterJid }) => {
  logger.warn('Skipping poll choice inbox notification due to missing tenant context', {
    requestId,
    pollId,
    voterJid,
  });
});

pollChoiceEventBus.on('pollChoiceInboxDecision', ({ decision, requestId }) => {
  if (decision.status === 'skip') {
    logger.info('Skipping poll choice inbox notification because poll message already exists', {
      requestId,
      pollId: decision.pollId,
      tenantId: decision.tenantId ?? null,
      chatId: decision.chatId ?? null,
      messageId: decision.existingMessageId,
    });
    return;
  }

  if (decision.status === 'requireInbox') {
    if (decision.lookupError) {
      logger.error('Failed to check existing poll message before inbox notification', {
        requestId,
        pollId: decision.pollId,
        tenantId: decision.tenantId,
        chatId: decision.chatId ?? null,
        error: decision.lookupError,
      });
    }

    if (decision.existingMessageId) {
      logger.info(
        'Triggering poll choice inbox notification fallback due to outdated poll message metadata',
        {
          requestId,
          pollId: decision.pollId,
          tenantId: decision.tenantId,
          chatId: decision.chatId ?? null,
          messageId: decision.existingMessageId,
        }
      );
    }
  }
});

pollChoiceEventBus.on('pollChoiceInboxFailed', ({ requestId, pollId, tenantId, reason, error }) => {
  logger.error('Failed to notify poll choice inbox', {
<<<<<<< HEAD
=======
  const logMethod = reason === 'poll_choice_inbox_error' ? 'error' : 'warn';
  logger[logMethod]('Poll choice inbox notification failed', {
>>>>>>> main
    requestId,
    pollId,
    tenantId,
    reason,
    error,
  });
});

pollChoiceEventBus.on('pollChoiceError', ({ requestId, pollId, tenantId, instanceId, error }) => {
  logger.error('Unexpected poll choice handler failure', {
<<<<<<< HEAD
=======
  logger.error('Failed to process poll choice event', {
>>>>>>> main
    requestId,
    pollId,
    tenantId,
    instanceId,
    error,
  });
});

pollChoiceEventBus.on('pollChoiceCompleted', ({ tenantId, instanceId, outcome, reason }) => {
  logger.info('pollChoicePipeline.completed', {
    tenantId,
    instanceId,
    outcome,
<<<<<<< HEAD
=======
  whatsappWebhookEventsCounter.inc({
    origin: 'webhook',
    tenantId: tenantId ?? 'unknown',
    instanceId: instanceId ?? 'unknown',
    result: outcome,
>>>>>>> main
    reason,
  });
});

<<<<<<< HEAD
=======
export type PollChoicePipelineContext = {
  poll: PollChoiceEventPayload & { selectedOptions: PollChoiceSelectedOptionPayload[] };
  state: PollChoiceState;
  persistence: PersistPollChoiceVoteResult;
};

export const emitPollChoiceCompleted = (
  payload: PollChoiceEventBusPayloads['pollChoiceCompleted']
) => {
  pollChoiceEventBus.emit('pollChoiceCompleted', payload);
};

>>>>>>> main
