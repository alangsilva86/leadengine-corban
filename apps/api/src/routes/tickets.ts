import { Router, Request, Response } from 'express';
import { body, param } from 'express-validator';
import { SalesStage } from '@ticketz/core';
import type {
  CreateTicketDTO,
  UpdateTicketDTO,
  TicketFilters,
  Pagination,
  TicketStatus,
} from '../types/tickets';
import { asyncHandler } from '../middleware/error-handler';
import { requireTenant } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import {
  assignTicket,
  closeTicket,
  createTicket,
  getTicketById,
  listTickets,
  updateTicket,
  type TicketIncludeOption,
  type ListTicketsOptions,
} from '../services/ticket-service';
import { resolveRequestTenantId } from '../services/tenant-service';
import {
  ensureTicketId,
  isUuidOrCuid,
  paginationValidation,
  validateTicketId,
} from './tickets.shared';
import {
  parseBooleanParam,
  parseDateParam,
  parseListParam,
} from '../utils/request-parsers';

const router: Router = Router();

const allowedStageValues = Object.values(SalesStage);

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
  body('stage').optional().isIn(allowedStageValues),
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
  body('stage').optional().isIn(allowedStageValues),
  body('tags').optional().isArray(),
  body('metadata').optional().isObject(),
  body('closeReason').optional().isString().isLength({ max: 500 }),
];

const updateStatusValidation = [
  param('id').custom(validateTicketId),
  body('status').isIn(['OPEN', 'PENDING', 'ASSIGNED', 'RESOLVED', 'CLOSED']).withMessage('Status inválido para ticket'),
  body('reason').optional().isString().isLength({ max: 500 }),
];

// GET /api/tickets - Listar tickets
router.get(
  '/',
  paginationValidation,
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const sourceInstanceParam = (req.query.sourceInstance ?? req.query.instanceId) as
      | string
      | string[]
      | undefined;
    const filters: TicketFilters = {
      status: parseListParam(req.query.status) as TicketFilters['status'],
      priority: parseListParam(req.query.priority) as TicketFilters['priority'],
      queueId: parseListParam(req.query.queueId),
      userId: parseListParam(req.query.userId),
      channel: parseListParam(req.query.channel) as TicketFilters['channel'],
      stage: parseListParam(req.query.stage) as TicketFilters['stage'],
      tags: parseListParam(req.query.tags),
      dateFrom: parseDateParam(req.query.dateFrom),
      dateTo: parseDateParam(req.query.dateTo),
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      sourceInstance: parseListParam(sourceInstanceParam),
      campaignId: parseListParam(req.query.campaignId),
      campaignName: parseListParam(req.query.campaignName),
      productType: parseListParam(req.query.productType),
      strategy: parseListParam(req.query.strategy),
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

    const includeOptions = include && include.length > 0 ? include : undefined;
    const options =
      includeOptions || includeMetrics === true
        ? ({
            ...(includeOptions ? { include: includeOptions } : {}),
            ...(includeMetrics === true ? { includeMetrics: true } : {}),
          } satisfies ListTicketsOptions)
        : undefined;

    const tenantId = resolveRequestTenantId(req);
    const result = options
      ? await listTickets(tenantId, filters, pagination, options)
      : await listTickets(tenantId, filters, pagination);

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
    const ticketId = ensureTicketId(req.params.id);
    const include = sanitizeIncludeOptions(parseListParam(req.query.include));
    const tenantId = resolveRequestTenantId(req);
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
    const tenantId = resolveRequestTenantId(req);
    const createTicketDTO: CreateTicketDTO = {
      tenantId,
      contactId: req.body.contactId,
      queueId: req.body.queueId,
      subject: req.body.subject,
      channel: req.body.channel,
      priority: req.body.priority ?? 'NORMAL',
      stage: req.body.stage,
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
    const ticketId = ensureTicketId(req.params.id);
    const tenantId = resolveRequestTenantId(req);

    const updateData: UpdateTicketDTO = {
      status: req.body.status,
      priority: req.body.priority,
      subject: req.body.subject,
      userId: req.body.userId,
      queueId: req.body.queueId,
      stage: req.body.stage,
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
    const ticketId = ensureTicketId(req.params.id);
    const status = req.body.status as TicketStatus;
    const reason = typeof req.body.reason === 'string' ? req.body.reason : undefined;
    const tenantId = resolveRequestTenantId(req);

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
    const ticketId = ensureTicketId(req.params.id);
    const userId = req.body.userId as string;
    const tenantId = resolveRequestTenantId(req);
    const ticket = await assignTicket(tenantId, ticketId, userId);

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
  param('id').custom(validateTicketId),
  body('reason').optional().isString().isLength({ max: 500 }),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const ticketId = ensureTicketId(req.params.id);
    const reason = req.body.reason as string | undefined;
    const tenantId = resolveRequestTenantId(req);
    const ticket = await closeTicket(tenantId, ticketId, reason, req.user!.id);

    res.json({
      success: true,
      message: 'Ticket closed successfully',
      data: ticket,
    });
  })
);


export { router as ticketsRouter };
