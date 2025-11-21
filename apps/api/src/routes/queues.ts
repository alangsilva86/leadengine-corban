import { Router, type Request, type Response } from 'express';
import { body, param, query } from 'express-validator';

import { asyncHandler } from '../middleware/error-handler';
import { requireTenant } from '../middleware/auth';
import { withTenantContext } from '../middleware/tenant-context';
import { validateRequest } from '../middleware/validation';
import { QueueHttpSerializer } from '../modules/queues/queue.http';
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
  query('includeItems').optional().isBoolean().toBoolean(),
  body('items').isArray({ min: 1 }).withMessage('items must be a non-empty array'),
  body('items.*.id').isString().trim().isLength({ min: 1 }),
  body('items.*.orderIndex').isInt({ min: 0 }).toInt(),
];

const router: Router = Router();

const queueService = new QueueService();
const queueSerializer = new QueueSerializer();
const queueHttpSerializer = new QueueHttpSerializer(queueSerializer);

router.use(requireTenant, withTenantContext);

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenantContext!.tenantId;
    const queues = await queueService.listQueues(tenantId);

    queueHttpSerializer.respondWithQueueList(res, queues);
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

    queueHttpSerializer.respondWithQueue(res, queue, 201);
  })
);

router.patch(
  '/:queueId',
  updateQueueValidation,
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenantContext!.tenantId;
    const { queueId } = req.params;

    const result = queueHttpSerializer.buildQueueUpdates(req.body as Record<string, unknown>);

    if ('error' in result) {
      queueHttpSerializer.respondWithError(res, result.error);
      return;
    }

    const queue = await queueService.updateQueue(tenantId, queueId, result.updates);

    if (!queue) {
      queueHttpSerializer.respondNotFound(res);
      return;
    }

    queueHttpSerializer.respondWithQueue(res, queue);
  })
);

router.patch(
  '/reorder',
  reorderValidation,
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenantContext!.tenantId;
    const includeItems = (req.query.includeItems as boolean | undefined) ?? true;
    const items = queueSerializer.buildReorderItems(req.body as Record<string, unknown>);

    const reordered = await queueService.reorderQueues(tenantId, items, includeItems);

    if (!reordered.updated) {
      queueHttpSerializer.respondNotFound(res, 'Nenhuma fila válida encontrada para reordenar.');
      return;
    }

    if (!includeItems) {
      queueHttpSerializer.respondWithSuccess(res);
      return;
    }

    queueHttpSerializer.respondWithQueueList(res, reordered.queues ?? []);
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
      queueHttpSerializer.respondNotFound(res);
      return;
    }

    queueHttpSerializer.respondWithDelete(res);
  })
);

export { router as queuesRouter };
