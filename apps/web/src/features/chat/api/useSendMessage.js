import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost } from '@/lib/api.js';
import { computeBackoffDelay } from '@/lib/rate-limit.js';
import emitInboxTelemetry from '../utils/telemetry.js';

const MAX_RETRY_ATTEMPTS = 3;
const RETRYABLE_STATUS = new Set([502, 503, 504]);
const RETRYABLE_CODES = new Set(['BROKER_ERROR', 'BROKER_TIMEOUT', 'RATE_LIMITED']);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const extractErrorCode = (error) => {
  const code = error?.payload?.error?.code ?? error?.payload?.code ?? null;
  if (typeof code === 'string') {
    return code.trim().toUpperCase();
  }
  return null;
};

const extractRequestId = (error) => {
  const requestId = error?.payload?.error?.requestId ?? error?.payload?.requestId ?? null;
  return typeof requestId === 'string' && requestId.trim().length > 0 ? requestId.trim() : null;
};

const shouldRetryError = (error) => {
  const status = typeof error?.status === 'number' ? error.status : null;
  const code = extractErrorCode(error);
  if (status && RETRYABLE_STATUS.has(status)) {
    return true;
  }
  if (code && RETRYABLE_CODES.has(code)) {
    return true;
  }
  return false;
};

export const useSendMessage = ({ fallbackTicketId } = {}) => {
  const queryClient = useQueryClient();

    return useMutation({
      mutationKey: ['chat', 'send-message', fallbackTicketId ?? null],
      mutationFn: async ({
        ticketId,
        content,
      type = 'TEXT',
      mediaUrl,
      mediaMimeType,
      mediaFileName,
      caption,
      quotedMessageId,
      metadata,
      instanceId,
      }) => {
        const targetTicketId = ticketId ?? fallbackTicketId;
        if (!targetTicketId) {
          throw new Error('ticketId is required to send a message');
        }

        let lastError = null;
        for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt += 1) {
          try {
            const response = await apiPost('/api/tickets/messages', {
              ticketId: targetTicketId,
              content,
              type,
              mediaUrl,
              mediaMimeType,
              mediaFileName,
              caption,
              quotedMessageId,
              metadata,
              instanceId,
            });

            if (attempt > 0) {
              emitInboxTelemetry('chat.outbound_retry_recovered', {
                ticketId: targetTicketId,
                attempt,
              });
            }

            return response?.data ?? null;
          } catch (error) {
            lastError = error;
            const retryable = shouldRetryError(error);
            const nextAttempt = attempt + 1;
            const requestId = extractRequestId(error);
            const code = extractErrorCode(error);
            const status = typeof error?.status === 'number' ? error.status : null;

            if (!retryable || nextAttempt >= MAX_RETRY_ATTEMPTS) {
              if (retryable && nextAttempt >= MAX_RETRY_ATTEMPTS) {
                emitInboxTelemetry('chat.outbound_retry_exhausted', {
                  ticketId: targetTicketId,
                  attempt: nextAttempt,
                  status,
                  code,
                  requestId,
                });
              }
              throw error;
            }

            const delayMs = computeBackoffDelay(nextAttempt, { baseMs: 750, maxMs: 6000 });
            emitInboxTelemetry('chat.outbound_retry_scheduled', {
              ticketId: targetTicketId,
              attempt: nextAttempt,
              delayMs,
              status,
              code,
              requestId,
            });
            await sleep(delayMs);
          }
        }

        if (lastError) {
          throw lastError;
        }

        return null;
      },
    onSuccess: (message) => {
      if (!message?.ticketId) {
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['chat', 'messages', message.ticketId] });
      queryClient.invalidateQueries({ queryKey: ['chat', 'tickets'] });
    },
  });
};

export default useSendMessage;
