import { Router, Request, Response } from 'express';
import { body, param } from 'express-validator';
import { WhatsAppTransportError } from '@ticketz/wa-contracts';

import type { MessageType, Pagination } from '../types/tickets';
import { asyncHandler } from '../middleware/error-handler';
import { requireTenant } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import {
  listMessages,
  sendMessage as sendTicketMessage,
} from '../services/ticket-service';
import { resolveRequestTenantId } from '../services/tenant-service';
import { ensureTicketId, paginationValidation, validateTicketId } from './tickets.shared';
import { logger } from '../config/logger';
import {
  WhatsAppBrokerError,
  WhatsAppBrokerNotConfiguredError,
} from '../services/whatsapp-broker-client';
import { recordBrokerFailure, recordBrokerSuccess } from '../services/broker-observability';
import {
  hasStructuredContactData,
  hasValidLocationData,
  hasValidTemplateData,
  normalizeContactsPayload,
  normalizeLocationPayload,
  normalizeTemplatePayload,
} from '../utils/message-normalizers';
import {
  normalizeString,
  resolveBrokerCode,
  resolveBrokerStatus,
  resolveRequestId,
} from '../utils/request-parsers';

const router: Router = Router();
const allowedMediaTypes = new Set(['image', 'video', 'audio', 'document']);

const allowedFileMessageTypes = new Set(['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT']);
const allowedMessageTypes = new Set<MessageType | 'TEXT'>([
  'TEXT',
  'IMAGE',
  'AUDIO',
  'VIDEO',
  'DOCUMENT',
  'LOCATION',
  'CONTACT',
  'TEMPLATE',
]);
const encodeCursor = (page: number): string => Buffer.from(String(page)).toString('base64url');
const decodeCursor = (cursor: string | undefined): number | null => {
  if (!cursor) {
    return null;
  }

  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = Number.parseInt(decoded, 10);
    return Number.isNaN(parsed) ? null : parsed;
  } catch (error) {
    logger.warn('Invalid cursor provided to tickets.messages router', { cursor, error });
    return null;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const buildRecoveryHint = (requestId: string | null): string => {
  const base =
    'Confira o status do envio no atendimento antes de fazer outra tentativa.';
  if (requestId) {
    return `${base} ID da falha: ${requestId}.`;
  }
  return base;
};

const sendMessageValidation = [
  body('chatId').optional().isString().trim().isLength({ min: 1 }),
  body('iid').optional().isString().trim().isLength({ min: 1 }),
  body('ticketId').optional().custom(validateTicketId),
  body().custom((value) => {
    if (!value || typeof value !== 'object') {
      throw new Error('Corpo da requisição inválido.');
    }

    const hasChatId = typeof value.chatId === 'string' && value.chatId.trim().length > 0;
    const hasTicketId = typeof value.ticketId === 'string' && value.ticketId.trim().length > 0;

    if (!hasChatId && !hasTicketId) {
      throw new Error('Informe chatId ou ticketId para enviar a mensagem.');
    }

    const hasText = typeof value.text === 'string' && value.text.trim().length > 0;
    const hasContent = typeof value.content === 'string' && value.content.trim().length > 0;
    const media = value.media;
    const hasMedia = media && typeof media === 'object';
    const mediaBase64 = normalizeString(media?.base64);
    const mediaUrl = normalizeString(media?.mediaUrl);

    if (hasMedia) {
      const mediaType = normalizeString(media.mediaType)?.toLowerCase();
      if (!mediaType || !allowedMediaTypes.has(mediaType)) {
        throw new Error('media.mediaType deve ser image, video, audio ou document');
      }

      const hasPayload = mediaBase64 || mediaUrl;
      if (!hasPayload) {
        throw new Error('media.base64 ou media.mediaUrl deve ser informado');
      }
    }

    const rawType = typeof value.type === 'string' ? value.type.trim().toUpperCase() : 'TEXT';
    if (rawType && !allowedMessageTypes.has(rawType as MessageType)) {
      throw new Error('Tipo de mensagem inválido.');
    }

    const normalizedType = allowedMessageTypes.has(rawType as MessageType)
      ? (rawType as MessageType)
      : 'TEXT';
    const requiresMedia = allowedFileMessageTypes.has(normalizedType);
    const hasMediaUrl =
      (typeof value.mediaUrl === 'string' && value.mediaUrl.trim().length > 0) || Boolean(mediaUrl);
    const hasMediaBase64 = Boolean(mediaBase64);

    if (normalizedType === 'TEXT' && !hasContent && !hasText) {
      throw new Error('Informe content ou text para enviar mensagem.');
    }

    if (normalizedType === 'LOCATION' && !hasValidLocationData(value.location ?? value.coordinates)) {
      throw new Error('Informe location.latitude e location.longitude válidos para mensagens de localização.');
    }

    if (normalizedType === 'CONTACT' && !hasStructuredContactData(value.contacts ?? value.contact ?? value.vcard)) {
      throw new Error('Informe os dados do contato (vCard ou campos estruturados) para enviar mensagem de contato.');
    }

    if (normalizedType === 'TEMPLATE' && !hasValidTemplateData(value.template)) {
      throw new Error('Informe os dados do template para enviar mensagem de template.');
    }

    if (requiresMedia && !hasMediaUrl && !hasMediaBase64) {
      throw new Error('mediaUrl ou media.base64 deve ser informado para mensagens de mídia.');
    }

    return true;
  }),
];

router.get(
  '/:id/messages',
  param('id').custom(validateTicketId),
  paginationValidation,
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const ticketId = ensureTicketId(req.params.id);

    const { page = 1, limit = 50, sortOrder = 'asc' } = req.query as Partial<{
      page: number;
      limit: number;
      sortOrder: 'asc' | 'desc';
    }>;

    const rawCursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const cursorPage = decodeCursor(rawCursor);
    const effectivePage = cursorPage ?? page ?? 1;

    const pagination: Pagination = {
      page: effectivePage,
      limit,
      sortBy: 'createdAt',
      sortOrder,
    };

    const tenantId = resolveRequestTenantId(req);
    const result = await listMessages(tenantId, ticketId, pagination);
    const windowState = typeof req.query.window === 'string' ? req.query.window.trim().toLowerCase() : undefined;
    if (windowState === 'open') {
      res.setHeader('Cache-Control', 'no-store');
    }
    const requestIdHeader =
      typeof req.headers['x-request-id'] === 'string' ? req.headers['x-request-id'] : undefined;
    res.once('finish', () => {
      logger.info('🧾 Etapa5-Serialize: timeline entregue', {
        requestId: requestIdHeader ?? null,
        ticketId,
        tenantId,
        page: result.page,
        messageCount: result.items.length,
        cacheControl: res.getHeader('Cache-Control') ?? null,
        etag: res.getHeader('ETag') ?? null,
      });
    });

    const nextCursor = result.hasNext ? encodeCursor(result.page + 1) : null;
    const prevCursor = result.hasPrev ? encodeCursor(Math.max(1, result.page - 1)) : null;
    const currentCursor = encodeCursor(result.page);

    res.json({
      success: true,
      data: {
        ...result,
        tenantId,
        ticketId,
        pagination,
        cursor: rawCursor ?? currentCursor,
        cursors: {
          next: nextCursor,
          prev: prevCursor,
        },
      },
    });
  })
);

router.post(
  '/messages',
  sendMessageValidation,
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = resolveRequestTenantId(req);
    const chatId = normalizeString(req.body.chatId);
    const ticketId = normalizeString(req.body.ticketId);
    const text = normalizeString(req.body.text) ?? normalizeString(req.body.content);
    const instanceOverride = normalizeString(req.body.iid) ?? normalizeString(req.body.instanceId);
    const baseRequestId = resolveRequestId(req);
    const requestWithRid = req as Request & { rid?: string };
    if (!requestWithRid.rid) {
      requestWithRid.rid = baseRequestId;
    }
    if (!res.getHeader('X-Request-Id')) {
      res.setHeader('X-Request-Id', baseRequestId);
    }

    if (!chatId && ticketId) {
      const rawType = typeof req.body.type === 'string' ? req.body.type.trim().toUpperCase() : 'TEXT';
      const normalizedType = allowedMessageTypes.has(rawType as MessageType) ? (rawType as MessageType) : 'TEXT';
      const metadata = isRecord(req.body.metadata)
        ? { ...(req.body.metadata as Record<string, unknown>) }
        : ({} as Record<string, unknown>);

      const locationPayload =
        normalizedType === 'LOCATION'
          ? normalizeLocationPayload(req.body.location ?? req.body.coordinates)
          : null;
      const contactsPayload =
        normalizedType === 'CONTACT'
          ? normalizeContactsPayload(req.body.contacts ?? req.body.contact ?? req.body.vcard)
          : null;
      const templatePayload =
        normalizedType === 'TEMPLATE' ? normalizeTemplatePayload(req.body.template) : null;

      if (locationPayload) {
        metadata.location = locationPayload;
      }

      if (contactsPayload) {
        metadata.contacts = contactsPayload;
      }

      if (templatePayload) {
        metadata.template = templatePayload;
      }

      if (allowedFileMessageTypes.has(normalizedType)) {
        const mediaMetadata: Record<string, unknown> = {};
        const mediaUrl = normalizeString(req.body.mediaUrl);
        const mediaFileName = normalizeString(req.body.mediaFileName ?? req.body.fileName);
        const mediaMimeType = normalizeString(req.body.mediaMimeType ?? req.body.mimetype);

        if (mediaUrl) {
          mediaMetadata.url = mediaUrl;
        }
        if (mediaFileName) {
          mediaMetadata.fileName = mediaFileName;
        }
        if (mediaMimeType) {
          mediaMetadata.mimeType = mediaMimeType;
        }

        if (Object.keys(mediaMetadata).length > 0) {
          metadata.media = mediaMetadata;
        }
      }

      if (typeof req.body.previewUrl === 'boolean') {
        metadata.previewUrl = req.body.previewUrl;
      }

      const attemptContext = {
        tenantId,
        ticketId,
        chatId: null,
        instanceId: instanceOverride ?? null,
      } as const;

      try {
        const message = await sendTicketMessage(tenantId, req.user?.id, {
          ticketId,
          type: normalizedType,
          instanceId: instanceOverride ?? undefined,
          direction: 'OUTBOUND',
          content: text ?? undefined,
          caption: normalizeString(req.body.caption) ?? undefined,
          mediaUrl: normalizeString(req.body.mediaUrl) ?? undefined,
          mediaFileName: normalizeString(req.body.mediaFileName ?? req.body.fileName) ?? undefined,
          mediaMimeType: normalizeString(req.body.mediaMimeType ?? req.body.mimetype) ?? undefined,
          quotedMessageId: normalizeString(req.body.quotedMessageId) ?? undefined,
          metadata,
          idempotencyKey: normalizeString(req.body.idempotencyKey) ?? undefined,
        });

        recordBrokerSuccess({ ...attemptContext, brokerStatus: 200, requestId: baseRequestId });
        logger.info('📤 [Tickets] outbound registrado (ticket path)', {
          requestId: baseRequestId,
          tenantId,
          ticketId: message.ticketId,
          messageId: message.id,
          instanceId: message.instanceId ?? attemptContext.instanceId,
          messageType: message.type ?? normalizedType,
        });

        res.status(201).json({
          success: true,
          message: 'Mensagem enviada com sucesso',
          data: {
            ...message,
            ticketId: message.ticketId,
          },
        });
      } catch (error) {
        if (error instanceof WhatsAppBrokerNotConfiguredError) {
          res.status(503).json({
            success: false,
            error: {
              code: 'BROKER_NOT_CONFIGURED',
              message: error.message,
              ...(error.missing ? { missing: error.missing } : {}),
            },
          });
          return;
        }

        if (error instanceof WhatsAppBrokerError || error instanceof WhatsAppTransportError) {
          const requestId = resolveRequestId(req, error);
          const brokerStatus = resolveBrokerStatus(error) ?? 502;
          const brokerCode = resolveBrokerCode(error) ?? 'BROKER_ERROR';
          recordBrokerFailure({
            ...attemptContext,
            brokerStatus,
            errorCode: brokerCode,
            requestId,
          });
          logger.error('🚨 [Tickets] outbound falhou (ticket path)', {
            tenantId,
            ticketId,
            instanceId: attemptContext.instanceId,
            brokerStatus,
            brokerCode,
            requestId,
            error,
          });
          res.status(502).json({
            success: false,
            error: {
              code: 'BROKER_ERROR',
              message: error instanceof Error ? error.message : String(error),
              brokerCode,
              brokerStatus,
              requestId,
              ticketId,
              recoveryHint: buildRecoveryHint(requestId),
            },
          });
          return;
        }

        throw error;
      }
      return;
    }

    res.status(409).json({
      success: false,
      error: { code: 'CONVERSATION_REQUIRED', message: 'Envie mensagens a partir de um atendimento verificado.' },
    });
  })
);

export { router as ticketsMessagesRouter };
