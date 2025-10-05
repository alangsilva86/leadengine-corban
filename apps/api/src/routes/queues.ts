import { Router, Request, Response } from 'express';
import { body, param } from 'express-validator';
import { asyncHandler } from '../middleware/error-handler';
import { requireTenant } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { prisma } from '../lib/prisma';

const queueSelect = {
  id: true,
  tenantId: true,
  name: true,
  description: true,
  color: true,
  isActive: true,
  orderIndex: true,
  settings: true,
  createdAt: true,
  updatedAt: true,
} as const;

const createQueueValidation = [
  body('name').isString().trim().isLength({ min: 1, max: 120 }).withMessage('name is required'),
  body('description').optional().isString().isLength({ max: 300 }),
  body('color').optional().isString().isLength({ max: 32 }),
  body('isActive').optional().isBoolean().toBoolean(),
  body('orderIndex').optional().isInt({ min: 0 }).toInt(),
  body('settings').optional().isObject(),
];

const updateQueueValidation = [
  param('queueId').isString().trim().isLength({ min: 1 }),
  body('name').optional().isString().trim().isLength({ min: 1, max: 120 }),
  body('description').optional().isString().isLength({ max: 300 }),
  body('color').optional().isString().isLength({ max: 32 }),
  body('isActive').optional().isBoolean().toBoolean(),
  body('orderIndex').optional().isInt({ min: 0 }).toInt(),
  body('settings').optional().isObject(),
];

const reorderValidation = [
  body('items').isArray({ min: 1 }).withMessage('items must be a non-empty array'),
  body('items.*.id').isString().trim().isLength({ min: 1 }),
  body('items.*.orderIndex').isInt({ min: 0 }).toInt(),
];

const sanitizeOptionalString = (value: unknown): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const router: Router = Router();

router.get(
  '/',
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.tenantId;

    const queues = await prisma.queue.findMany({
      where: { tenantId },
      orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
      select: queueSelect,
    });

    res.json({
      success: true,
      data: {
        items: queues,
        total: queues.length,
      },
    });
  })
);

router.post(
  '/',
  createQueueValidation,
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.tenantId;
    const {
      name,
      description,
      color,
      isActive,
      orderIndex,
      settings,
    } = req.body as {
      name: string;
      description?: string;
      color?: string;
      isActive?: boolean;
      orderIndex?: number;
      settings?: Record<string, unknown>;
    };

    const nextOrderIndex =
      typeof orderIndex === 'number'
        ? orderIndex
        : await prisma.queue.count({ where: { tenantId } });

    const queue = await prisma.queue.create({
      data: {
        tenantId,
        name: name.trim(),
        description: sanitizeOptionalString(description) ?? undefined,
        color: sanitizeOptionalString(color) ?? undefined,
        isActive: typeof isActive === 'boolean' ? isActive : true,
        orderIndex: nextOrderIndex,
        settings: typeof settings === 'object' && settings !== null ? settings : undefined,
      },
      select: queueSelect,
    });

    res.status(201).json({
      success: true,
      data: queue,
    });
  })
);

router.patch(
  '/:queueId',
  updateQueueValidation,
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.tenantId;
    const { queueId } = req.params;

    const updates: Record<string, unknown> = {};
    const hasOwn = Object.prototype.hasOwnProperty;

    if (hasOwn.call(req.body, 'name')) {
      updates.name = String((req.body as { name?: string }).name ?? '').trim();
    }

    if (hasOwn.call(req.body, 'description')) {
      updates.description = sanitizeOptionalString((req.body as { description?: string }).description) ?? null;
    }

    if (hasOwn.call(req.body, 'color')) {
      const normalized = sanitizeOptionalString((req.body as { color?: string }).color);
      updates.color = normalized ?? null;
    }

    if (hasOwn.call(req.body, 'isActive')) {
      updates.isActive = Boolean((req.body as { isActive?: boolean }).isActive);
    }

    if (hasOwn.call(req.body, 'orderIndex')) {
      updates.orderIndex = (req.body as { orderIndex?: number }).orderIndex;
    }

    if (hasOwn.call(req.body, 'settings')) {
      const rawSettings = (req.body as { settings?: Record<string, unknown> | null }).settings;
      updates.settings = typeof rawSettings === 'object' && rawSettings !== null ? rawSettings : {};
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'QUEUE_NO_UPDATES',
          message: 'Informe ao menos um campo para atualizar.',
        },
      });
      return;
    }

    const updatedCount = await prisma.queue.updateMany({
      where: { id: queueId, tenantId },
      data: updates,
    });

    if (updatedCount.count === 0) {
      res.status(404).json({
        success: false,
        error: {
          code: 'QUEUE_NOT_FOUND',
          message: 'Fila não encontrada para o tenant informado.',
        },
      });
      return;
    }

    const queue = await prisma.queue.findUnique({
      where: { id: queueId },
      select: queueSelect,
    });

    res.json({
      success: true,
      data: queue,
    });
  })
);

router.patch(
  '/reorder',
  reorderValidation,
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.tenantId;
    const items = (req.body.items as Array<{ id: string; orderIndex: number }>).filter(Boolean);

    const queueIds = await prisma.queue.findMany({
      where: { tenantId, id: { in: items.map((item) => item.id) } },
      select: { id: true },
    });

    const allowedIds = new Set(queueIds.map((item) => item.id));

    const updates = items.filter((item) => allowedIds.has(item.id));

    if (updates.length === 0) {
      res.status(404).json({
        success: false,
        error: {
          code: 'QUEUE_NOT_FOUND',
          message: 'Nenhuma fila válida encontrada para reordenar.',
        },
      });
      return;
    }

    await prisma.$transaction(
      updates.map((item) =>
        prisma.queue.updateMany({
          where: { id: item.id, tenantId },
          data: { orderIndex: item.orderIndex },
        })
      )
    );

    const refreshed = await prisma.queue.findMany({
      where: { tenantId },
      orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
      select: queueSelect,
    });

    res.json({
      success: true,
      data: {
        items: refreshed,
        total: refreshed.length,
      },
    });
  })
);

router.delete(
  '/:queueId',
  [param('queueId').isString().trim().isLength({ min: 1 })],
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.tenantId;
    const { queueId } = req.params;

    const deleted = await prisma.queue.deleteMany({
      where: { id: queueId, tenantId },
    });

    if (deleted.count === 0) {
      res.status(404).json({
        success: false,
        error: {
          code: 'QUEUE_NOT_FOUND',
          message: 'Fila não encontrada para o tenant informado.',
        },
      });
      return;
    }

    res.json({ success: true });
  })
);

export { router as queuesRouter };
