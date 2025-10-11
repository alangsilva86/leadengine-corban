import { Buffer } from 'node:buffer';
import { Router, Request, Response } from 'express';
import { body, param, query } from 'express-validator';
import {
  CreateTicketDTO,
  UpdateTicketDTO,
  SendMessageDTO,
  TicketFilters,
  Pagination,
  TicketStatus,
} from '@ticketz/core';
import { asyncHandler } from '../middleware/error-handler';
import { requireTenant } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import {
  addTicketNote,
  assignTicket,
  closeTicket,
  createTicket,
  getTicketById,
  listMessages,
  listTickets,
  sendMessage,
  updateTicket,
  type CreateTicketNoteInput,
  type TicketIncludeOption,
} from '../services/ticket-service';

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

const sendMessageValidation = [
  body('ticketId').custom(validateTicketId),
  body('content').isString().isLength({ min: 1 }),
  body('type').optional().isIn(['TEXT', 'IMAGE', 'AUDIO', 'VIDEO', 'DOCUMENT', 'LOCATION', 'CONTACT', 'TEMPLATE']),
  body('mediaUrl').optional().isURL(),
  body('quotedMessageId').optional().custom(validateTicketId),
  body('metadata').optional().isObject(),
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

    const tenantId = req.user!.tenantId;
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
    const ticket = await getTicketById(req.user!.tenantId, ticketId, {
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
    const createTicketDTO: CreateTicketDTO = {
      tenantId: req.user!.tenantId,
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

    const ticket = await updateTicket(req.user!.tenantId, ticketId, updateData);

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

    const updateData: UpdateTicketDTO = {
      status,
      closeReason: reason,
    };

    const ticket = await updateTicket(req.user!.tenantId, ticketId, updateData);

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
    const ticket = await assignTicket(req.user!.tenantId, ticketId, userId);

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
      req.user!.tenantId,
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
    const ticket = await closeTicket(req.user!.tenantId, ticketId, reason, req.user!.id);

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

    const result = await listMessages(req.user!.tenantId, ticketId, pagination);

    const nextCursor = result.hasNext ? encodeCursor(result.page + 1) : null;
    const prevCursor = result.hasPrev ? encodeCursor(Math.max(1, result.page - 1)) : null;
    const currentCursor = encodeCursor(result.page);

    res.json({
      success: true,
      data: {
        ...result,
        tenantId: req.user!.tenantId,
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
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const sendMessageDTO: SendMessageDTO & { tenantId: string; userId: string } = {
      ticketId: req.body.ticketId,
      content: req.body.content,
      type: req.body.type || 'TEXT',
      mediaUrl: req.body.mediaUrl,
      quotedMessageId: req.body.quotedMessageId,
      metadata: req.body.metadata || {},
      tenantId: req.user!.tenantId,
      userId: req.user!.id,
    };

    const message = await sendMessage(req.user!.tenantId, req.user!.id, sendMessageDTO);

    res.status(201).json({
      success: true,
      data: message,
    });
  })
);

export { router as ticketsRouter };
