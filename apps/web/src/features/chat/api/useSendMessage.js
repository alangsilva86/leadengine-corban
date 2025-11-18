import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost } from '@/lib/api.js';
import { computeBackoffDelay } from '@/lib/rate-limit.js';
import emitInboxTelemetry from '../utils/telemetry.js';

const MAX_RETRY_ATTEMPTS = 3;
const RETRYABLE_STATUS = new Set([502, 503, 504]);
const RETRYABLE_CODES = new Set(['BROKER_ERROR', 'BROKER_TIMEOUT', 'RATE_LIMITED']);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeString = (value) => {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
};

const generateIdempotencyKey = () => {
  const rand = Math.random().toString(36).slice(2, 10);
  return `web-${Date.now().toString(36)}-${rand}`;
};

const normalizeMessageType = (rawType, hasMedia) => {
  const normalized = typeof rawType === 'string' ? rawType.trim().toLowerCase() : '';
  if (!normalized && hasMedia) {
    return 'document';
  }
  if (!normalized) {
    return 'text';
  }
  return normalized;
};

const buildPayload = ({
  type,
  content,
  mediaUrl,
  mediaMimeType,
  mediaFileName,
  caption,
}) => {
  const normalizedType = type ?? 'text';
  const normalizedContent = normalizeString(content);
  switch (normalizedType) {
    case 'image':
    case 'video':
    case 'audio':
    case 'document': {
      const resolvedUrl = normalizeString(mediaUrl);
      if (!resolvedUrl) {
        throw new Error('Não foi possível enviar o anexo: mediaUrl ausente.');
      }
      const payload = {
        type: normalizedType,
        mediaUrl: resolvedUrl,
      };
      if (normalizedContent) {
        payload.text = normalizedContent;
      }
      if (caption && caption.length > 0) {
        payload.caption = caption;
      }
      if (mediaMimeType) {
        payload.mimeType = mediaMimeType;
      }
      if (mediaFileName) {
        payload.fileName = mediaFileName;
      }
      return payload;
    }
    case 'text':
    default: {
      if (!normalizedContent) {
        throw new Error('Digite a mensagem para enviar.');
      }
      return { type: 'text', text: normalizedContent };
    }
  }
};

const isRetryableResult = (result) => {
  const code = typeof result?.error?.code === 'string' ? result.error.code.trim().toUpperCase() : null;
  const status = typeof result?.error?.status === 'number' ? result.error.status : null;
  if ((status && RETRYABLE_STATUS.has(status)) || (code && RETRYABLE_CODES.has(code))) {
    return { retryable: true, code, status, requestId: result?.error?.requestId ?? null };
  }
  return { retryable: false, code, status, requestId: result?.error?.requestId ?? null };
};

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
      metadata: _metadata,
      instanceId,
    }) => {
      const targetTicketId = ticketId ?? fallbackTicketId;
      if (!targetTicketId) {
        throw new Error('ticketId is required to send a message');
      }

      let lastError = null;
      for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt += 1) {
        try {
          const hasMediaAttachment = Boolean(mediaUrl);
          const normalizedType = normalizeMessageType(type, hasMediaAttachment);
          const payload = buildPayload({
            type: normalizedType,
            content,
            mediaUrl,
            mediaMimeType,
            mediaFileName,
            caption,
          });
          const idempotencyKey = generateIdempotencyKey();
          const response = await apiPost(
            `/api/tickets/${targetTicketId}/messages`,
            {
              instanceId: instanceId ?? undefined,
              payload,
              idempotencyKey,
              ...(quotedMessageId ? { quotedMessageId } : {}),
            },
            {
              headers: {
                'Idempotency-Key': idempotencyKey,
              },
            }
          );

          if (response?.error) {
            const retryInfo = isRetryableResult(response);
            const nextAttempt = attempt + 1;
            if (retryInfo.retryable && nextAttempt < MAX_RETRY_ATTEMPTS) {
              const delayMs = computeBackoffDelay(nextAttempt, { baseMs: 750, maxMs: 6000 });
              emitInboxTelemetry('chat.outbound_retry_scheduled', {
                ticketId: targetTicketId,
                attempt: nextAttempt,
                delayMs,
                status: retryInfo.status ?? null,
                code: retryInfo.code ?? null,
                requestId: retryInfo.requestId,
              });
              await sleep(delayMs);
              continue;
            }

            if (retryInfo.retryable && nextAttempt >= MAX_RETRY_ATTEMPTS) {
              emitInboxTelemetry('chat.outbound_retry_exhausted', {
                ticketId: targetTicketId,
                attempt: nextAttempt,
                status: retryInfo.status ?? null,
                code: retryInfo.code ?? null,
                requestId: retryInfo.requestId,
              });
            }

            return response ?? null;
          }

          if (attempt > 0) {
            emitInboxTelemetry('chat.outbound_retry_recovered', {
              ticketId: targetTicketId,
              attempt,
            });
          }

          return response ?? null;
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
    onSuccess: (result) => {
      if (!result?.ticketId) {
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['chat', 'messages', result.ticketId] });
      queryClient.invalidateQueries({ queryKey: ['chat', 'tickets'] });
    },
  });
};

export default useSendMessage;
