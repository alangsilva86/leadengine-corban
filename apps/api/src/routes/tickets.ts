import { Router, Request, Response } from 'express';
import { body, param, query } from 'express-validator';
import {
  CreateTicketDTO,
  UpdateTicketDTO,
  SendMessageDTO,
  TicketFilters,
  Pagination,
} from '@ticketz/core';
import { asyncHandler } from '../middleware/error-handler';
import { requireTenant } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import {
  assignTicket,
  closeTicket,
  createTicket,
  getTicketById,
  listMessages,
  listTickets,
  sendMessage,
  updateTicket,
} from '../services/ticket-service';

const router: Router = Router();

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

// Validações
const createTicketValidation = [
  body('contactId').isUUID().withMessage('Contact ID must be a valid UUID'),
  body('queueId').isUUID().withMessage('Queue ID must be a valid UUID'),
  body('subject').optional().isString().isLength({ max: 200 }),
  body('channel').isIn(['WHATSAPP', 'EMAIL', 'SMS', 'VOICE', 'CHAT', 'SOCIAL']),
  body('priority').optional().isIn(['LOW', 'NORMAL', 'HIGH', 'URGENT']),
  body('tags').optional().isArray(),
  body('metadata').optional().isObject(),
];

const updateTicketValidation = [
  param('id').isUUID().withMessage('Ticket ID must be a valid UUID'),
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
  body('ticketId').isUUID().withMessage('Ticket ID must be a valid UUID'),
  body('content').isString().isLength({ min: 1 }),
  body('type').optional().isIn(['TEXT', 'IMAGE', 'AUDIO', 'VIDEO', 'DOCUMENT', 'LOCATION', 'CONTACT', 'TEMPLATE']),
  body('mediaUrl').optional().isURL(),
  body('quotedMessageId').optional().isUUID(),
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

    const tenantId = req.user!.tenantId;
    const result = await listTickets(tenantId, filters, pagination);

    res.json({
      success: true,
      data: {
        ...result,
        filters,
        pagination,
      },
    });
  })
);

// GET /api/tickets/:id - Buscar ticket por ID
router.get(
  '/:id',
  param('id').isUUID(),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const ticketId = req.params.id;
    const ticket = await getTicketById(req.user!.tenantId, ticketId);

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

// POST /api/tickets/:id/assign - Atribuir ticket a um usuário
router.post(
  '/:id/assign',
  param('id').isUUID(),
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

// POST /api/tickets/:id/close - Fechar ticket
router.post(
  '/:id/close',
  param('id').isUUID(),
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
  param('id').isUUID(),
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

    const pagination: Pagination = {
      page,
      limit,
      sortBy: 'createdAt',
      sortOrder,
    };

    const result = await listMessages(req.user!.tenantId, ticketId, pagination);

    res.json({
      success: true,
      data: {
        ...result,
        tenantId: req.user!.tenantId,
        ticketId,
        pagination,
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
