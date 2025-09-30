import { Router, Request, Response } from 'express';
import { query, body } from 'express-validator';
import { LeadSource, LeadStatus } from '@prisma/client';
import { asyncHandler } from '../middleware/error-handler';
import { requireTenant } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { prisma } from '../lib/prisma';
import { ValidationError, NotFoundError } from '@ticketz/core';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const paginationValidation = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: MAX_LIMIT }).toInt(),
  query('status')
    .optional()
    .customSanitizer((value) => (typeof value === 'string' ? value.split(',') : value))
    .custom((value) => {
      if (!value) {
        return true;
      }

      const allowedStatuses = new Set(Object.values(LeadStatus));

      const values = Array.isArray(value) ? value : [value];

      for (const item of values) {
        if (typeof item !== 'string' || !allowedStatuses.has(item.toUpperCase() as LeadStatus)) {
          throw new Error('Invalid lead status');
        }
      }

      return true;
    }),
];

const createLeadValidation = [
  body('contactId').isString().trim().isLength({ min: 1 }).withMessage('contactId is required'),
  body('source')
    .isString()
    .customSanitizer((value) => (typeof value === 'string' ? value.toUpperCase() : value))
    .custom((value) => Object.values(LeadSource).includes(value))
    .withMessage(`source must be one of: ${Object.values(LeadSource).join(', ')}`),
  body('status')
    .optional()
    .isString()
    .customSanitizer((value) => (typeof value === 'string' ? value.toUpperCase() : value))
    .custom((value) => Object.values(LeadStatus).includes(value))
    .withMessage(`status must be one of: ${Object.values(LeadStatus).join(', ')}`),
  body('value').optional().isFloat().withMessage('value must be a number').toFloat(),
  body('probability')
    .optional()
    .isInt({ min: 0, max: 100 })
    .toInt()
    .withMessage('probability must be between 0 and 100'),
  body('tags').optional().isArray().withMessage('tags must be an array'),
];

const isValidLeadStatus = (value: unknown): value is LeadStatus =>
  typeof value === 'string' && Object.values(LeadStatus).includes(value as LeadStatus);

const isValidLeadSource = (value: unknown): value is LeadSource =>
  typeof value === 'string' && Object.values(LeadSource).includes(value as LeadSource);

const parseDate = (value: unknown): Date | undefined => {
  if (!value) {
    return undefined;
  }

  const date = value instanceof Date ? value : new Date(value as string);

  if (Number.isNaN(date.getTime())) {
    throw new ValidationError('Invalid date provided');
  }

  return date;
};

const normalizeTags = (value: unknown): string[] | undefined => {
  if (!value) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new ValidationError('tags must be an array');
  }

  const tags = value.map((item) => String(item).trim()).filter(Boolean);

  return tags.length > 0 ? tags : undefined;
};

const parseStatusFilter = (value: unknown): LeadStatus[] | undefined => {
  if (!value) {
    return undefined;
  }

  const values = Array.isArray(value) ? value : [value];
  const statuses = values
    .map((item) => String(item).trim().toUpperCase())
    .filter((item): item is LeadStatus => Object.values(LeadStatus).includes(item as LeadStatus));

  return statuses.length > 0 ? statuses : undefined;
};

const router: Router = Router();

// GET /api/leads - Listar leads
router.get(
  '/',
  paginationValidation,
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.tenantId;
    const { page = DEFAULT_PAGE, limit = DEFAULT_LIMIT, status } = req.query as Partial<{
      page: number;
      limit: number;
      status: string[];
    }>;

    const safeLimit = Math.min(Math.max(limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const safePage = Math.max(page ?? DEFAULT_PAGE, 1);
    const skip = (safePage - 1) * safeLimit;

    const statusFilter = parseStatusFilter(status);

    const where = {
      tenantId,
      ...(statusFilter ? { status: { in: statusFilter } } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: safeLimit,
        include: {
          contact: true,
          campaign: true,
          assignee: true,
        },
      }),
      prisma.lead.count({ where }),
    ]);

    const totalPages = safeLimit > 0 ? Math.ceil(total / safeLimit) : 0;
    const hasNext = safePage < totalPages;
    const hasPrev = safePage > 1 && totalPages > 0;

    res.json({
      success: true,
      data: {
        items,
        total,
        page: safePage,
        limit: safeLimit,
        totalPages,
        hasNext,
        hasPrev,
      },
    });
  })
);

// POST /api/leads - Criar novo lead
router.post(
  '/',
  createLeadValidation,
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.tenantId;
    const contactId = req.body.contactId as string;

    const contact = await prisma.contact.findUnique({ where: { id: contactId } });

    if (!contact || contact.tenantId !== tenantId) {
      throw new NotFoundError('Contact', contactId);
    }

    const status = isValidLeadStatus(req.body.status) ? req.body.status : LeadStatus.NEW;
    const source = isValidLeadSource(req.body.source) ? req.body.source : undefined;

    if (!source) {
      throw new ValidationError('source is required');
    }

    const lead = await prisma.lead.create({
      data: {
        tenantId,
        contactId,
        campaignId: typeof req.body.campaignId === 'string' ? req.body.campaignId : undefined,
        userId: typeof req.body.userId === 'string' ? req.body.userId : undefined,
        status,
        source,
        score: typeof req.body.score === 'object' && req.body.score !== null ? req.body.score : undefined,
        value: typeof req.body.value === 'number' ? req.body.value : undefined,
        probability: typeof req.body.probability === 'number' ? req.body.probability : undefined,
        expectedCloseDate: parseDate(req.body.expectedCloseDate),
        actualCloseDate: parseDate(req.body.actualCloseDate),
        lostReason: typeof req.body.lostReason === 'string' ? req.body.lostReason : undefined,
        tags: normalizeTags(req.body.tags) ?? [],
        customFields:
          typeof req.body.customFields === 'object' && req.body.customFields !== null ? req.body.customFields : undefined,
        lastContactAt: parseDate(req.body.lastContactAt),
        nextFollowUpAt: parseDate(req.body.nextFollowUpAt),
        notes: typeof req.body.notes === 'string' ? req.body.notes : undefined,
      },
      include: {
        contact: true,
        campaign: true,
        assignee: true,
      },
    });

    res.status(201).json({
      success: true,
      data: lead,
    });
  })
);

export { router as leadsRouter };
