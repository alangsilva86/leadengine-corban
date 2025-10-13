import { Router, Request, Response } from 'express';
import { body, query } from 'express-validator';
import { asyncHandler } from '../middleware/error-handler';
import { AUTH_MVP_BYPASS_TENANT_ID, requireTenant } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { prisma } from '../lib/prisma';
import { ConflictError, ValidationError } from '@ticketz/core';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const paginationValidation = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: MAX_LIMIT }).toInt(),
  query('search').optional().isString(),
];

const createContactValidation = [
  body('name').isString().isLength({ min: 1 }).withMessage('name is required'),
  body('phone').optional().isString(),
  body('email').optional().isEmail().withMessage('email must be valid'),
  body('document').optional().isString(),
  body('tags').optional().isArray().withMessage('tags must be an array'),
  body('customFields').optional().isObject().withMessage('customFields must be an object'),
];

const isPrismaKnownError = (error: unknown): error is { code?: string; meta?: Record<string, unknown> } =>
  typeof error === 'object' && error !== null;

const parseTags = (value: unknown): string[] | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new ValidationError('tags must be an array of strings');
  }

  const tags = value.map((item) => String(item).trim()).filter(Boolean);

  return tags.length > 0 ? tags : undefined;
};

const router: Router = Router();

// GET /api/contacts - Listar contatos
router.get(
  '/',
  paginationValidation,
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId ?? AUTH_MVP_BYPASS_TENANT_ID;
    const { page = DEFAULT_PAGE, limit = DEFAULT_LIMIT, search, phone } = req.query as Partial<{
      page: number;
      limit: number;
      search: string;
      phone: string;
    }>;

    const normalizedPhone = typeof phone === 'string' && phone.trim().length > 0 ? phone.trim() : undefined;

    if (normalizedPhone) {
      const contact = await prisma.contact.findFirst({
        where: {
          tenantId,
          phone: normalizedPhone,
        },
      });

      res.json({
        success: true,
        data: {
          items: contact ? [contact] : [],
          total: contact ? 1 : 0,
          page: 1,
          limit: 1,
          totalPages: contact ? 1 : 0,
          hasNext: false,
          hasPrev: false,
        },
      });
      return;
    }

    const safeLimit = Math.min(Math.max(limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const safePage = Math.max(page ?? DEFAULT_PAGE, 1);
    const skip = (safePage - 1) * safeLimit;

    const searchTerm = typeof search === 'string' && search.trim().length > 0 ? search.trim() : undefined;

    const where = {
      tenantId,
      ...(searchTerm
        ? {
            OR: [
              { name: { contains: searchTerm, mode: 'insensitive' as const } },
              { email: { contains: searchTerm, mode: 'insensitive' as const } },
              { phone: { contains: searchTerm, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: safeLimit,
      }),
      prisma.contact.count({ where }),
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

// POST /api/contacts - Criar novo contato
router.post(
  '/',
  createContactValidation,
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId ?? AUTH_MVP_BYPASS_TENANT_ID;
    const tags = parseTags(req.body.tags);

    try {
      const contact = await prisma.contact.create({
        data: {
          tenantId,
          name: req.body.name,
          phone: typeof req.body.phone === 'string' ? req.body.phone : undefined,
          email: typeof req.body.email === 'string' ? req.body.email : undefined,
          document: typeof req.body.document === 'string' ? req.body.document : undefined,
          avatar: typeof req.body.avatar === 'string' ? req.body.avatar : undefined,
          isBlocked: typeof req.body.isBlocked === 'boolean' ? req.body.isBlocked : undefined,
          tags: tags ?? [],
          customFields:
            typeof req.body.customFields === 'object' && req.body.customFields !== null
              ? req.body.customFields
              : undefined,
          notes: typeof req.body.notes === 'string' ? req.body.notes : undefined,
        },
      });

      res.status(201).json({
        success: true,
        data: contact,
      });
    } catch (error) {
      if (isPrismaKnownError(error) && (error as { code?: string }).code === 'P2002') {
        throw new ConflictError('Contact already exists for this tenant', {
          target: (error as { meta?: Record<string, unknown> }).meta?.target,
        });
      }

      if (isPrismaKnownError(error) && (error as { code?: string }).code === 'P2003') {
        throw new ValidationError('Related record not found', {
          target: (error as { meta?: Record<string, unknown> }).meta?.field_name,
        });
      }

      throw error;
    }
  })
);

export { router as contactsRouter };
