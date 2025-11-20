import { Router, type Request, type Response } from 'express';
import { body, param } from 'express-validator';

import { asyncHandler } from '../middleware/error-handler';
import { requireTenant } from '../middleware/auth';
import { withTenantContext } from '../middleware/tenant-context';
import { validateRequest } from '../middleware/validation';
import { QueueSerializer } from '../modules/queues/queue.serializer';
import { QueueService } from '../modules/queues/queue.service';

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

const router: Router = Router();

const queueService = new QueueService();
const queueSerializer = new QueueSerializer();

router.use(requireTenant, withTenantContext);

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenantContext!.tenantId;
    const queues = await queueService.listQueues(tenantId);

    res.json({
      success: true,
      data: queueSerializer.serializeList(queues),
    });
  })
);

router.post(
  '/',
  createQueueValidation,
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenantContext!.tenantId;
    const payload = queueSerializer.buildCreateInput(req.body as Record<string, unknown>);

    const queue = await queueService.createQueue(tenantId, payload);

    res.status(201).json({
      success: true,
      data: queueSerializer.serialize(queue),
    });
  })
);

router.patch(
  '/:queueId',
  updateQueueValidation,
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenantContext!.tenantId;
    const { queueId } = req.params;

    const { updates, hasUpdates } = queueSerializer.buildUpdateInput(req.body as Record<string, unknown>);

    if (!hasUpdates) {
      res.status(400).json({
        success: false,
        error: {
          code: 'QUEUE_NO_UPDATES',
          message: 'Informe ao menos um campo para atualizar.',
        },
      });
      return;
    }

    const queue = await queueService.updateQueue(tenantId, queueId, updates);

    if (!queue) {
      res.status(404).json({
        success: false,
        error: {
          code: 'QUEUE_NOT_FOUND',
          message: 'Fila não encontrada para o tenant informado.',
        },
      });
      return;
    }

    res.json({
      success: true,
      data: queueSerializer.serialize(queue),
    });
  })
);

router.patch(
  '/reorder',
  reorderValidation,
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenantContext!.tenantId;
    const items = queueSerializer.buildReorderItems(req.body as Record<string, unknown>);

    const reordered = await queueService.reorderQueues(tenantId, items);

    if (reordered.length === 0) {
      res.status(404).json({
        success: false,
        error: {
          code: 'QUEUE_NOT_FOUND',
          message: 'Nenhuma fila válida encontrada para reordenar.',
        },
      });
      return;
    }

    res.json({
      success: true,
      data: queueSerializer.serializeList(reordered),
    });
  })
);

router.delete(
  '/:queueId',
  [param('queueId').isString().trim().isLength({ min: 1 })],
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenantContext!.tenantId;
    const { queueId } = req.params;

    const deleted = await queueService.deleteQueue(tenantId, queueId);

    if (!deleted) {
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
