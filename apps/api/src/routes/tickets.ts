import { Buffer } from 'node:buffer';
import { Router, Request, Response } from 'express';
import { body, param, query } from 'express-validator';
import {
  findOrCreateOpenTicketByChat,
  upsertMessageByExternalId,
  type PassthroughMessageMedia,
} from '@ticketz/storage';
import {
  CreateTicketDTO,
  UpdateTicketDTO,
  TicketFilters,
  Pagination,
  TicketStatus,
} from '@ticketz/core';
import { asyncHandler } from '../middleware/error-handler';
import { AUTH_MVP_BYPASS_TENANT_ID, requireTenant } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import {
  addTicketNote,
  assignTicket,
  closeTicket,
  createTicket,
  getTicketById,
  listMessages,
  listTickets,
  updateTicket,
  type CreateTicketNoteInput,
  type TicketIncludeOption,
} from '../services/ticket-service';
import { getSocketServer } from '../lib/socket-registry';
import { getDefaultInstanceId, getDefaultTenantId } from '../config/whatsapp';
import { WhatsAppBrokerNotConfiguredError } from '../services/whatsapp-broker-client';
import {
  getWhatsAppTransport,
  type WhatsAppTransportSendMessagePayload,
} from '../features/whatsapp-transport';

const router: Router = Router();

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const cuidRegex = /^c[0-9a-z]{24}$/i;

const isUuidOrCuid = (value: unknown): boolean => {
  if (typeof value !== 'string') {
    return false;
  }
  const normalized = value.trim();
  return uuidRegex.test(normalized) || cuidRegex.test(normalized);
};

const validateTicketId = (value: unknown): true => {
  if (!isUuidOrCuid(value)) {
    throw new Error('Ticket ID must be a valid UUID or CUID');
  }
  return true;
};

const parseListParam = (value: unknown): string[] | undefined => {
  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  if (Array.isArray(value)) {
    return value.map(String);
  }
  return undefined;
};

const parseDateParam = (value: unknown): Date | undefined => {
  if (typeof value === 'string' && value.trim().length > 0) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
  return undefined;
};

const parseBooleanParam = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false;
    }
  }

  return undefined;
};

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const safeTruncate = (value: unknown, limit = 2000): string => {
  if (typeof value === 'string') {
    return value.length > limit ? value.slice(0, limit) : value;
  }

  try {
    const serialized = JSON.stringify(value);
    if (!serialized) {
      return '';
    }
    return serialized.length > limit ? serialized.slice(0, limit) : serialized;
  } catch (error) {
    const fallback = String(value);
    return fallback.length > limit ? fallback.slice(0, limit) : fallback;
  }
};

const serializeError = (error: unknown): Record<string, unknown> => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ? safeTruncate(error.stack, 1000) : undefined,
    } satisfies Record<string, unknown>;
  }

  return {
    message: safeTruncate(error, 500),
  } satisfies Record<string, unknown>;
};

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
  const mediaType = normalizeString(mediaRecord.mediaType);
  if (!mediaType || !allowedMediaTypes.has(mediaType)) {
    return null;
  }

  const base64 = normalizeString(mediaRecord.base64);
  const mediaUrl = normalizeString(mediaRecord.mediaUrl);
  const mimetype = normalizeString(mediaRecord.mimetype ?? mediaRecord.mimeType);
  const fileName = normalizeString(mediaRecord.fileName ?? mediaRecord.filename);
  const caption = normalizeString(mediaRecord.caption);

  const broker = {
    mediaType: mediaType as 'image' | 'video' | 'audio' | 'document',
    mimetype: mimetype ?? undefined,
    base64: base64 ?? undefined,
    mediaUrl: mediaUrl ?? undefined,
    fileName: fileName ?? undefined,
    caption: caption ?? undefined,
  };

  const storage: PassthroughMessageMedia = {
    mediaType,
    caption: caption ?? undefined,
    mimeType: mimetype ?? undefined,
    fileName: fileName ?? undefined,
    url: mediaUrl ?? null,
    size: null,
  };

  return { broker, storage };
};

const includeLookup: Record<string, TicketIncludeOption> = {
  contact: 'contact',
  lead: 'lead',
  notes: 'notes',
};

const sanitizeIncludeOptions = (
  values: string[] | undefined
): TicketIncludeOption[] | undefined => {
  if (!values || values.length === 0) {
    return undefined;
  }

  const unique = new Set<TicketIncludeOption>();

  for (const raw of values) {
    const normalized = raw.trim().toLowerCase();
    const mapped = includeLookup[normalized];
    if (mapped) {
      unique.add(mapped);
    }
  }

  return unique.size > 0 ? Array.from(unique) : undefined;
};

const STATE_STATUS_MAP: Record<string, TicketStatus[]> = {
  open: ['OPEN', 'PENDING', 'ASSIGNED'],
  abertura: ['OPEN', 'PENDING', 'ASSIGNED'],
  aberto: ['OPEN', 'PENDING', 'ASSIGNED'],
  closed: ['RESOLVED', 'CLOSED'],
  fechado: ['RESOLVED', 'CLOSED'],
  resolved: ['RESOLVED'],
  resolvido: ['RESOLVED'],
};

const decodeCursor = (cursor: string | undefined): number | undefined => {
  if (!cursor) {
    return undefined;
  }

  try {
    const raw = Buffer.from(cursor, 'base64').toString('utf-8');
    const parsed = JSON.parse(raw) as { page?: number } | null;
    if (parsed && typeof parsed.page === 'number' && parsed.page >= 1) {
      return Math.floor(parsed.page);
    }
  } catch {
    return undefined;
  }

  return undefined;
};

const encodeCursor = (page: number): string => {
  return Buffer.from(JSON.stringify({ page }), 'utf-8').toString('base64');
};

// Validações
const createTicketValidation = [
  body('contactId')
    .custom((value) => {
      if (!isUuidOrCuid(value)) {
        throw new Error('Contact ID must be a valid UUID or CUID');
      }
      return true;
    }),
  body('queueId')
    .custom((value) => {
      if (!isUuidOrCuid(value)) {
        throw new Error('Queue ID must be a valid UUID or CUID');
      }
      return true;
    }),
  body('subject').optional().isString().isLength({ max: 200 }),
  body('channel').isIn(['WHATSAPP', 'EMAIL', 'SMS', 'VOICE', 'CHAT', 'SOCIAL']),
  body('priority').optional().isIn(['LOW', 'NORMAL', 'HIGH', 'URGENT']),
  body('tags').optional().isArray(),
  body('metadata').optional().isObject(),
];

const updateTicketValidation = [
  param('id').custom(validateTicketId),
  body('status').optional().isIn(['OPEN', 'PENDING', 'ASSIGNED', 'RESOLVED', 'CLOSED']),
  body('priority').optional().isIn(['LOW', 'NORMAL', 'HIGH', 'URGENT']),
  body('subject').optional().isString().isLength({ max: 200 }),
  body('userId').optional().isUUID(),
  body('queueId').optional().isUUID(),
  body('tags').optional().isArray(),
  body('metadata').optional().isObject(),
  body('closeReason').optional().isString().isLength({ max: 500 }),
];

const allowedMediaTypes = new Set(['image', 'video', 'audio', 'document']);

const sendMessageValidation = [
  body('chatId').isString().trim().isLength({ min: 1 }).withMessage('chatId é obrigatório'),
  body('iid').optional().isString().trim().isLength({ min: 1 }),
  body().custom((value) => {
    const hasText = typeof value?.text === 'string' && value.text.trim().length > 0;
    const media = value?.media;
    const hasMedia = media && typeof media === 'object';

    if (!hasText && !hasMedia) {
      throw new Error('Informe text ou media para enviar mensagem.');
    }

    if (hasMedia) {
      const mediaType = normalizeString(media.mediaType);
      if (!mediaType || !allowedMediaTypes.has(mediaType)) {
        throw new Error('media.mediaType deve ser image, video, audio ou document');
      }

      const hasPayload = normalizeString(media.base64) || normalizeString(media.mediaUrl);
      if (!hasPayload) {
        throw new Error('media.base64 ou media.mediaUrl deve ser informado');
      }
    }

    return true;
  }),
];

const updateStatusValidation = [
  param('id').custom(validateTicketId),
  body('status').isIn(['OPEN', 'PENDING', 'ASSIGNED', 'RESOLVED', 'CLOSED']).withMessage('Status inválido para ticket'),
  body('reason').optional().isString().isLength({ max: 500 }),
];

const createNoteValidation = [
  param('id').custom(validateTicketId),
  body('body').isString().isLength({ min: 1, max: 4000 }),
  body('visibility').optional().isIn(['private', 'team', 'public']),
  body('tags').optional().isArray(),
  body('metadata').optional().isObject(),
];

const paginationValidation = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('sortBy').optional().isString(),
  query('sortOrder').optional().isIn(['asc', 'desc']),
];

// GET /api/tickets - Listar tickets
router.get(
  '/',
  paginationValidation,
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const filters: TicketFilters = {
      status: parseListParam(req.query.status) as TicketFilters['status'],
      priority: parseListParam(req.query.priority) as TicketFilters['priority'],
      queueId: parseListParam(req.query.queueId),
      userId: parseListParam(req.query.userId),
      channel: parseListParam(req.query.channel) as TicketFilters['channel'],
      tags: parseListParam(req.query.tags),
      dateFrom: parseDateParam(req.query.dateFrom),
      dateTo: parseDateParam(req.query.dateTo),
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
    };

    if (!filters.status) {
      const rawStates = parseListParam(req.query.state);
      if (rawStates && rawStates.length > 0) {
        const normalizedStatuses = new Set<TicketStatus>();
        for (const raw of rawStates) {
          const mapped = STATE_STATUS_MAP[raw.trim().toLowerCase()];
          if (mapped) {
            mapped.forEach((status) => normalizedStatuses.add(status));
          }
        }

        if (normalizedStatuses.size > 0) {
          filters.status = Array.from(normalizedStatuses) as TicketStatus[];
        }
      }
    }

    const scope = typeof req.query.scope === 'string' ? req.query.scope.trim().toLowerCase() : undefined;
    if (scope === 'mine') {
      filters.userId = [req.user!.id];
    }

    const { page = 1, limit = 20, sortBy, sortOrder = 'desc' } = req.query as Partial<{
      page: number;
      limit: number;
      sortBy: string;
      sortOrder: 'asc' | 'desc';
    }>;

    const pagination: Pagination = {
      page,
      limit,
      sortBy,
      sortOrder,
    };

    const include = sanitizeIncludeOptions(parseListParam(req.query.include));
    const includeMetrics = parseBooleanParam(req.query.metrics) ?? parseBooleanParam(req.query.includeMetrics);

    const options: {
      include?: TicketIncludeOption[];
      includeMetrics?: boolean;
    } = {};

    if (include && include.length > 0) {
      options.include = include;
    }

    if (includeMetrics === true) {
      options.includeMetrics = true;
    }

    const tenantId = req.user?.tenantId ?? AUTH_MVP_BYPASS_TENANT_ID;
    const result = await listTickets(tenantId, filters, pagination, options);

    res.json({
      success: true,
      data: {
        ...result,
        filters,
        pagination,
        include,
      },
    });
  })
);

// GET /api/tickets/:id - Buscar ticket por ID
router.get(
  '/:id',
  param('id').custom(validateTicketId),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const ticketId = req.params.id;
    const include = sanitizeIncludeOptions(parseListParam(req.query.include));
    const tenantId = req.user?.tenantId ?? AUTH_MVP_BYPASS_TENANT_ID;
    const ticket = await getTicketById(tenantId, ticketId, {
      include,
    });

    res.json({ success: true, data: ticket });
  })
);

// POST /api/tickets - Criar novo ticket
router.post(
  '/',
  createTicketValidation,
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId ?? AUTH_MVP_BYPASS_TENANT_ID;
    const createTicketDTO: CreateTicketDTO = {
      tenantId,
      contactId: req.body.contactId,
      queueId: req.body.queueId,
      subject: req.body.subject,
      channel: req.body.channel,
      priority: req.body.priority ?? 'NORMAL',
      tags: req.body.tags ?? [],
      metadata: req.body.metadata ?? {},
    };

    const ticket = await createTicket(createTicketDTO);

    res.status(201).json({
      success: true,
      data: ticket,
    });
  })
);

// PUT /api/tickets/:id - Atualizar ticket
router.put(
  '/:id',
  updateTicketValidation,
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const ticketId = req.params.id;
    const tenantId = req.user?.tenantId ?? AUTH_MVP_BYPASS_TENANT_ID;

    const updateData: UpdateTicketDTO = {
      status: req.body.status,
      priority: req.body.priority,
      subject: req.body.subject,
      userId: req.body.userId,
      queueId: req.body.queueId,
      tags: req.body.tags,
      metadata: req.body.metadata,
      closeReason: req.body.closeReason,
    };

    const ticket = await updateTicket(tenantId, ticketId, updateData);

    res.json({
      success: true,
      data: ticket,
    });
  })
);

// POST /api/tickets/:id/status - Atualizar status do ticket
router.post(
  '/:id/status',
  updateStatusValidation,
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const ticketId = req.params.id;
    const status = req.body.status as TicketStatus;
    const reason = typeof req.body.reason === 'string' ? req.body.reason : undefined;
    const tenantId = req.user?.tenantId ?? AUTH_MVP_BYPASS_TENANT_ID;

    const updateData: UpdateTicketDTO = {
      status,
      closeReason: reason,
    };

    const ticket = await updateTicket(tenantId, ticketId, updateData);

    res.json({
      success: true,
      message: 'Ticket status atualizado com sucesso',
      data: ticket,
    });
  })
);

// POST /api/tickets/:id/assign - Atribuir ticket a um usuário
router.post(
  '/:id/assign',
  param('id').custom(validateTicketId),
  body('userId').isUUID(),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const ticketId = req.params.id;
    const userId = req.body.userId as string;
    const tenantId = req.user?.tenantId ?? AUTH_MVP_BYPASS_TENANT_ID;
    const ticket = await assignTicket(tenantId, ticketId, userId);

    res.json({
      success: true,
      message: 'Ticket assigned successfully',
      data: ticket,
    });
  })
);

// POST /api/tickets/:id/notes - Criar nota interna
router.post(
  '/:id/notes',
  createNoteValidation,
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const ticketId = req.params.id;
    const payload: CreateTicketNoteInput = {
      body: req.body.body,
      visibility: req.body.visibility,
      tags: Array.isArray(req.body.tags) ? req.body.tags.map(String) : undefined,
      metadata: req.body.metadata,
    };

    const note = await addTicketNote(
      req.user?.tenantId ?? AUTH_MVP_BYPASS_TENANT_ID,
      ticketId,
      {
        id: req.user!.id,
        name: req.user!.name,
      },
      payload
    );

    res.status(201).json({
      success: true,
      message: 'Nota adicionada ao ticket',
      data: note,
    });
  })
);

// POST /api/tickets/:id/close - Fechar ticket
router.post(
  '/:id/close',
  param('id').custom(validateTicketId),
  body('reason').optional().isString().isLength({ max: 500 }),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const ticketId = req.params.id;
    const reason = req.body.reason as string | undefined;
    const tenantId = req.user?.tenantId ?? AUTH_MVP_BYPASS_TENANT_ID;
    const ticket = await closeTicket(tenantId, ticketId, reason, req.user!.id);

    res.json({
      success: true,
      message: 'Ticket closed successfully',
      data: ticket,
    });
  })
);

// GET /api/tickets/:id/messages - Listar mensagens do ticket
router.get(
  '/:id/messages',
  param('id').custom(validateTicketId),
  paginationValidation,
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const ticketId = req.params.id;

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

    const tenantId = req.user?.tenantId ?? AUTH_MVP_BYPASS_TENANT_ID;
    const result = await listMessages(tenantId, ticketId, pagination);

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

// POST /api/tickets/messages - Enviar mensagem
router.post(
  '/messages',
  sendMessageValidation,
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = normalizeString(req.header('x-tenant-id')) ?? getDefaultTenantId();
    const chatId = normalizeString(req.body.chatId)!;
    const text = normalizeString(req.body.text);
    const iid = normalizeString(req.body.iid) ?? getDefaultInstanceId();
    const mediaPayload = normalizeOutboundMedia(req.body.media);
    const transport = getWhatsAppTransport();

    const instanceId = iid ?? getDefaultInstanceId();
    if (!instanceId) {
      res.status(400).json({ code: 'INSTANCE_REQUIRED', message: 'Informe iid ou configure WHATSAPP_DEFAULT_INSTANCE_ID.' });
      return;
    }

    const contactLabel = normalizeString(req.body.contactName) ?? chatId;

    try {
      const messagePayload: WhatsAppTransportSendMessagePayload = {
        to: chatId,
        content: text ?? mediaPayload?.broker.caption ?? '',
        caption: mediaPayload?.broker.caption,
        type: mediaPayload ? mediaPayload.broker.mediaType : 'text',
        media: mediaPayload ? (mediaPayload.broker as Record<string, unknown>) : undefined,
        mediaUrl: mediaPayload?.broker.mediaUrl,
        mediaMimeType: mediaPayload?.broker.mimetype,
        mediaFileName: mediaPayload?.broker.fileName,
        previewUrl: Boolean(req.body?.previewUrl),
      };

      const brokerResponse = await transport.sendMessage(instanceId, messagePayload);

      const externalId = brokerResponse.externalId ?? `TEMP-${Date.now()}`;
      const ticketContext = await findOrCreateOpenTicketByChat({
        tenantId,
        chatId,
        displayName: contactLabel,
        phone: chatId,
        instanceId,
      });

      const { message } = await upsertMessageByExternalId({
        tenantId,
        ticketId: ticketContext.ticket.id,
        chatId,
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

      emitRealtimeMessage(tenantId, ticketContext.ticket.id, message);

      res.status(200).json({
        messageId: message.id,
        externalId: message.externalId ?? externalId,
      });
    } catch (error) {
      if (error instanceof WhatsAppBrokerNotConfiguredError) {
        res.status(503).json({ code: 'BROKER_NOT_CONFIGURED' });
        return;
      }

      const ticketContext = await findOrCreateOpenTicketByChat({
        tenantId,
        chatId,
        displayName: contactLabel,
        phone: chatId,
        instanceId,
      });

      const errorId = `ERR-${Date.now()}`;
      const { message } = await upsertMessageByExternalId({
        tenantId,
        ticketId: ticketContext.ticket.id,
        chatId,
        direction: 'outbound',
        externalId: errorId,
        type: mediaPayload ? 'media' : 'text',
        text: text ?? mediaPayload?.storage.caption ?? null,
        media: mediaPayload ? mediaPayload.storage : null,
        metadata: {
          source: 'baileys',
          brokerError: serializeError(error),
          instanceId,
        },
        timestamp: Date.now(),
      });

      emitRealtimeMessage(tenantId, ticketContext.ticket.id, message);

      res.status(502).json({
        code: 'BROKER_ERROR',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  })
);

export { router as ticketsRouter };
