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
import { getSocketServer } from '../lib/socket-registry';
import { getDefaultInstanceId } from '../config/whatsapp';
import { logger } from '../config/logger';
import {
  WhatsAppBrokerError,
  WhatsAppBrokerNotConfiguredError,
} from '../services/whatsapp-broker-client';
import { getWhatsAppTransport, type WhatsAppTransportSendMessagePayload } from '../features/whatsapp-transport';
import { whatsappOutboundMetrics } from '../lib/metrics';
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
  safeTruncate,
  serializeError,
} from '../utils/request-parsers';
import { findOrCreateOpenTicketByChat, upsertMessageByExternalId, type PassthroughMessageMedia } from '@ticketz/storage';

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

const emitRealtimeMessage = (tenantId: string, ticketId: string, payload: unknown) => {
  const socket = getSocketServer();
  if (!socket) {
    return;
  }

  socket.to(`tenant:${tenantId}`).emit('messages.new', payload);
  socket.to(`ticket:${ticketId}`).emit('messages.new', payload);
};

const normalizeOutboundMedia = (
  value: unknown
):
  | {
      broker: {
        mediaType: 'image' | 'video' | 'audio' | 'document';
        mimetype?: string;
        base64?: string;
        mediaUrl?: string;
        fileName?: string;
        caption?: string;
      };
      storage: PassthroughMessageMedia;
    }
  | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const mediaRecord = value as Record<string, unknown>;
  const normalizedMediaType = normalizeString(mediaRecord.mediaType)?.toLowerCase();
  if (!normalizedMediaType || !allowedMediaTypes.has(normalizedMediaType)) {
    return null;
  }

  const base64 = normalizeString(mediaRecord.base64);
  const mediaUrl = normalizeString(mediaRecord.mediaUrl);
  const mimetype = normalizeString(mediaRecord.mimetype ?? mediaRecord.mimeType);
  const fileName = normalizeString(mediaRecord.fileName ?? mediaRecord.filename);
  const caption = normalizeString(mediaRecord.caption);
  const mediaKey = normalizeString(mediaRecord.mediaKey ?? mediaRecord.media_key);
  const directPath = normalizeString(mediaRecord.directPath ?? mediaRecord.direct_path);

  const broker: {
    mediaType: 'image' | 'video' | 'audio' | 'document';
    mimetype?: string;
    base64?: string;
    mediaUrl?: string;
    fileName?: string;
    caption?: string;
  } = {
    mediaType: normalizedMediaType as 'image' | 'video' | 'audio' | 'document',
  };

  if (mimetype) {
    broker.mimetype = mimetype;
  }
  if (base64) {
    broker.base64 = base64;
  }
  if (mediaUrl) {
    broker.mediaUrl = mediaUrl;
  }
  if (fileName) {
    broker.fileName = fileName;
  }
  if (caption) {
    broker.caption = caption;
  }

  const storage: PassthroughMessageMedia = {
    mediaType: normalizedMediaType as 'image' | 'video' | 'audio' | 'document',
    caption: caption ?? null,
    mimeType: mimetype ?? null,
    fileName: fileName ?? null,
    url: mediaUrl ?? null,
    size: null,
    base64: base64 ?? null,
    mediaKey: mediaKey ?? null,
    directPath: directPath ?? null,
  };

  return { broker, storage };
};

const buildRecoveryHint = (requestId: string | null): string => {
  const base =
    'Guardamos a mensagem e ela será reenviada automaticamente assim que o WhatsApp voltar a responder.';
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
    const mediaPayload = chatId ? normalizeOutboundMedia(req.body.media) : null;
    const transport = getWhatsAppTransport();
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

    const normalizedChatId = chatId;
    const instanceId = instanceOverride ?? getDefaultInstanceId();

    if (!normalizedChatId) {
      res.status(400).json({ code: 'CHAT_ID_REQUIRED', message: 'Informe chatId ou ticketId válido.' });
      return;
    }

    if (!instanceId) {
      res.status(400).json({ code: 'INSTANCE_REQUIRED', message: 'Informe iid ou configure WHATSAPP_DEFAULT_INSTANCE_ID.' });
      return;
    }

    const contactLabel = normalizeString(req.body.contactName) ?? normalizedChatId;
    const messageMetadata = isRecord(req.body.metadata)
      ? { ...(req.body.metadata as Record<string, unknown>) }
      : ({} as Record<string, unknown>);

    const requestedType = typeof req.body.type === 'string' ? req.body.type.trim().toUpperCase() : null;
    const normalizedLocation = normalizeLocationPayload(req.body.location ?? req.body.coordinates);
    const normalizedContacts = normalizeContactsPayload(req.body.contacts ?? req.body.contact ?? req.body.vcard);
    const normalizedTemplate = normalizeTemplatePayload(req.body.template);

    if (normalizedLocation) {
      messageMetadata.location = normalizedLocation;
    }

    if (normalizedContacts) {
      messageMetadata.contacts = normalizedContacts;
    }

    if (normalizedTemplate) {
      messageMetadata.template = normalizedTemplate;
    }

    if (typeof req.body.previewUrl === 'boolean') {
      messageMetadata.previewUrl = req.body.previewUrl;
    }

    const normalizedType = (() => {
      if (requestedType && allowedMessageTypes.has(requestedType as MessageType)) {
        return requestedType.toLowerCase();
      }
      if (mediaPayload) {
        return mediaPayload.broker.mediaType;
      }
      if (normalizedLocation) {
        return 'location';
      }
      if (normalizedTemplate) {
        return 'template';
      }
      if (normalizedContacts) {
        return 'contact';
      }
      return 'text';
    })();

    try {
      const messagePayload: WhatsAppTransportSendMessagePayload = {
        to: normalizedChatId,
        content: text ?? mediaPayload?.broker.caption ?? '',
        type: normalizedType,
        previewUrl: Boolean(req.body?.previewUrl),
      };

      if (mediaPayload?.broker.caption) {
        messagePayload.caption = mediaPayload.broker.caption;
      }

      if (mediaPayload) {
        messagePayload.media = mediaPayload.broker as Record<string, unknown>;
      }

      if (mediaPayload?.broker.mediaUrl) {
        messagePayload.mediaUrl = mediaPayload.broker.mediaUrl;
      }

      if (mediaPayload?.broker.mimetype) {
        messagePayload.mediaMimeType = mediaPayload.broker.mimetype;
      }

      if (mediaPayload?.broker.fileName) {
        messagePayload.mediaFileName = mediaPayload.broker.fileName;
      }

      if (normalizedType === 'location' && normalizedLocation) {
        messagePayload.location = normalizedLocation;
      }

      if (normalizedType === 'template' && normalizedTemplate) {
        messagePayload.template = normalizedTemplate;
      }

      if (normalizedType === 'contact' && normalizedContacts) {
        messagePayload.contacts = normalizedContacts;
      }

      if (Object.keys(messageMetadata).length > 0) {
        messagePayload.metadata = messageMetadata;
      }

      const startedAt = Date.now();
      const brokerResponse = await transport.sendMessage(instanceId, messagePayload);
      const latencyMs = Date.now() - startedAt;
      const metricBase = {
        origin: 'tickets.router',
        tenantId,
        instanceId,
      } as const;
      const outboundStatus =
        typeof (brokerResponse as Record<string, unknown>).status === 'string'
          ? ((brokerResponse as Record<string, unknown>).status as string)
          : 'SENT';
      whatsappOutboundMetrics.incTotal({ ...metricBase, status: outboundStatus });
      whatsappOutboundMetrics.observeLatency(metricBase, latencyMs);

      const externalId = brokerResponse.externalId ?? `TEMP-${Date.now()}`;
      const ticketContext = await findOrCreateOpenTicketByChat({
        tenantId,
        chatId: normalizedChatId,
        displayName: contactLabel,
        phone: normalizedChatId,
        instanceId,
      });

      const { message } = await upsertMessageByExternalId({
        tenantId,
        ticketId: ticketContext.ticket.id,
        chatId: normalizedChatId,
        direction: 'outbound',
        externalId,
        type: mediaPayload ? 'media' : 'text',
        text: text ?? mediaPayload?.storage.caption ?? null,
        media: mediaPayload ? mediaPayload.storage : null,
        metadata: {
          source: 'baileys',
          brokerResponse: safeTruncate(brokerResponse),
          instanceId,
        },
        timestamp: Date.now(),
      });

      recordBrokerSuccess({
        tenantId,
        ticketId: ticketContext.ticket.id,
        chatId: normalizedChatId,
        instanceId,
        brokerStatus: 200,
        requestId: baseRequestId,
      });
      logger.info('📤 [Tickets] outbound enviado', {
        tenantId,
        ticketId: ticketContext.ticket.id,
        chatId: normalizedChatId,
        instanceId,
        brokerStatus: 200,
        requestId: baseRequestId,
        messageId: message.id,
        externalId: message.externalId ?? externalId,
      });

      emitRealtimeMessage(tenantId, ticketContext.ticket.id, message);

      res.status(200).json({
        success: true,
        data: {
          messageId: message.id,
          externalId: message.externalId ?? externalId,
          ticketId: ticketContext.ticket.id,
          ticket: ticketContext.ticket,
          message,
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

      const ticketContext = await findOrCreateOpenTicketByChat({
        tenantId,
        chatId: normalizedChatId,
        displayName: contactLabel,
        phone: normalizedChatId,
        instanceId,
      });

      const errorId = `ERR-${Date.now()}`;
      const requestId = resolveRequestId(req, error);
      const brokerStatus = resolveBrokerStatus(error) ?? 502;
      const brokerCode = resolveBrokerCode(error) ?? 'BROKER_ERROR';
      const { message } = await upsertMessageByExternalId({
        tenantId,
        ticketId: ticketContext.ticket.id,
        chatId: normalizedChatId,
        direction: 'outbound',
        externalId: errorId,
        type: mediaPayload ? 'media' : 'text',
        text: text ?? mediaPayload?.storage.caption ?? null,
        media: mediaPayload ? mediaPayload.storage : null,
        metadata: {
          source: 'baileys',
          brokerError: serializeError(error),
          instanceId,
          retry: {
            status: 'pending',
            reason: brokerCode,
            requestId,
            capturedAt: new Date().toISOString(),
          },
        },
        timestamp: Date.now(),
      });

      recordBrokerFailure({
        tenantId,
        ticketId: ticketContext.ticket.id,
        chatId: normalizedChatId,
        instanceId,
        brokerStatus,
        errorCode: brokerCode,
        requestId,
        recoveryQueued: true,
      });
      logger.error('🚨 [Tickets] outbound falhou', {
        tenantId,
        ticketId: ticketContext.ticket.id,
        chatId: normalizedChatId,
        instanceId,
        brokerStatus,
        brokerCode,
        requestId,
        error,
      });
      emitRealtimeMessage(tenantId, ticketContext.ticket.id, message);

      res.status(502).json({
        success: false,
        error: {
          code: 'BROKER_ERROR',
          message: error instanceof Error ? error.message : String(error),
          brokerCode,
          brokerStatus,
          requestId,
          ticketId: ticketContext.ticket.id,
          queuedMessageId: message.id,
          recoveryHint: buildRecoveryHint(requestId),
        },
      });
    }
  })
);

export { router as ticketsMessagesRouter };
