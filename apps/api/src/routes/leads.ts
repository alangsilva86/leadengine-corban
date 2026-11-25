import { Router, Request, Response } from 'express';
import { query, body } from 'express-validator';
import { LeadSource, LeadStatus } from '@prisma/client';
import {
  LEAD_STAGES,
  LEAD_STAGE_TO_LEGACY_LEAD_STATUS,
  LEGACY_LEAD_STATUS_TO_LEAD_STAGE,
  parseLeadStage,
} from '../lib/lead-stages';
import { asyncHandler } from '../middleware/error-handler';
import { requireTenant } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { prisma } from '../lib/prisma';
import { ValidationError, NotFoundError } from '@ticketz/core';
import {
  buildPaginatedResponse,
  buildPaginationValidators,
  parsePaginationParams,
} from '../utils/pagination';
import { resolveRequestTenantId } from '../services/tenant-service';

const paginationValidation = [
  ...buildPaginationValidators(),
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
  body('stage')
    .optional()
    .custom((value) => parseLeadStage(value, { legacy: false }) !== null)
    .withMessage(`stage must be one of: ${LEAD_STAGES.join(', ')}`),
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
    const tenantId = resolveRequestTenantId(req);
    const { page, limit, skip } = parsePaginationParams(req.query as Record<string, unknown>);
    const { status } = req.query as Partial<{ status: string[] }>;

    const statusFilter = parseStatusFilter(status);

    const where = {
      tenantId,
      contact: { tenantId },
      AND: [{ OR: [{ campaignId: null }, { campaign: { tenantId } }] }, { OR: [{ userId: null }, { assignee: { tenantId } }] }],
      ...(statusFilter ? { status: { in: statusFilter } } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          contact: true,
          campaign: true,
          assignee: { select: { id: true, name: true, role: true } },
        },
      }),
      prisma.lead.count({ where }),
    ]);

    res.json({
      success: true,
      data: buildPaginatedResponse({ items, total, page, limit }),
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
    const tenantId = resolveRequestTenantId(req);
    const contactId = req.body.contactId as string;

    const campaignId = typeof req.body.campaignId === 'string' ? req.body.campaignId : undefined;
    const userId = typeof req.body.userId === 'string' ? req.body.userId : undefined;
    const [contact, campaign, assignee] = await Promise.all([
      prisma.contact.findFirst({ where: { id: contactId, tenantId }, select: { id: true } }),
      campaignId ? prisma.campaign.findFirst({ where: { id: campaignId, tenantId }, select: { id: true } }) : null,
      userId ? prisma.user.findFirst({ where: { id: userId, tenantId, isActive: true }, select: { id: true } }) : null,
    ]);
    if (!contact) throw new NotFoundError('Contact', contactId);
    if (campaignId && !campaign) throw new NotFoundError('Campaign', campaignId);
    if (userId && !assignee) throw new NotFoundError('User', userId);

    // Funil único: `stage` é a fonte da verdade e `status` é espelhado a partir dela.
    const requestedStage = parseLeadStage(req.body.stage, { legacy: false });
    const status: LeadStatus = requestedStage
      ? (LEAD_STAGE_TO_LEGACY_LEAD_STATUS[requestedStage] as LeadStatus)
      : isValidLeadStatus(req.body.status)
        ? req.body.status
        : LeadStatus.NEW;
    const stage = requestedStage ?? LEGACY_LEAD_STATUS_TO_LEAD_STAGE[status] ?? 'novo';
    const source = isValidLeadSource(req.body.source) ? req.body.source : undefined;

    if (!source) {
      throw new ValidationError('source is required');
    }

    const lead = await prisma.lead.create({
      data: {
        tenantId,
        contactId,
        campaignId,
        userId,
        stage,
        status,
        source,
        score: typeof req.body.score === 'object' && req.body.score !== null ? req.body.score : undefined,
        value: typeof req.body.value === 'number' ? req.body.value : undefined,
        probability: typeof req.body.probability === 'number' ? req.body.probability : undefined,
        expectedCloseDate: parseDate(req.body.expectedCloseDate) ?? null,
        actualCloseDate: parseDate(req.body.actualCloseDate) ?? null,
        lostReason: typeof req.body.lostReason === 'string' ? req.body.lostReason : undefined,
        tags: normalizeTags(req.body.tags) ?? [],
        customFields:
          typeof req.body.customFields === 'object' && req.body.customFields !== null ? req.body.customFields : undefined,
        lastContactAt: parseDate(req.body.lastContactAt) ?? null,
        nextFollowUpAt: parseDate(req.body.nextFollowUpAt) ?? null,
        notes: typeof req.body.notes === 'string' ? req.body.notes : undefined,
      },
      include: {
        contact: true,
        campaign: true,
        assignee: { select: { id: true, name: true, role: true } },
      },
    });

    res.status(201).json({
      success: true,
      data: lead,
    });
  })
);

export { router as leadsRouter };
