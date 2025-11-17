import { Router, type Request, type Response } from 'express';
import {
  CreateContactTaskPayloadSchema,
  NotFoundError,
  UpdateContactTaskPayloadSchema,
} from '@ticketz/core';
import { createContactTask, listContactTasks, updateContactTask } from '@ticketz/storage';

import { asyncHandler } from '../middleware/error-handler';
import { requireTenant } from '../middleware/auth';
import {
  ContactIdParamSchema,
  ListContactTasksQuerySchema,
  TaskIdParamSchema,
  parseOrRespond,
} from './contacts/schemas';

const contactTasksRouter: Router = Router();

contactTasksRouter.get(
  '/:contactId/tasks',
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const params = parseOrRespond(ContactIdParamSchema, req.params, res);
    if (!params) {
      return;
    }

    const query = parseOrRespond(ListContactTasksQuerySchema, req.query, res);
    if (!query) {
      return;
    }

    const tenantId = req.user!.tenantId;
    const pagination: { page?: number; limit?: number; sortBy?: string; sortOrder?: 'asc' | 'desc' } = {};
    if (typeof query.page === 'number' && Number.isFinite(query.page)) {
      pagination.page = query.page;
    }
    if (typeof query.limit === 'number' && Number.isFinite(query.limit)) {
      pagination.limit = query.limit;
    }
    if (typeof query.sortBy === 'string' && query.sortBy.trim()) {
      pagination.sortBy = query.sortBy.trim();
    }
    if (query.sortOrder) {
      pagination.sortOrder = query.sortOrder;
    }

    const pageValue = pagination.page ?? 1;
    const limitValue = pagination.limit ?? 20;
    const sortOrderValue = pagination.sortOrder ?? 'desc';
    const statusFilterTasks =
      Array.isArray(query.status) && query.status.length > 0 ? query.status : undefined;

    const result = await listContactTasks({
      tenantId,
      contactId: params.contactId,
      page: pageValue,
      limit: limitValue,
      sortOrder: sortOrderValue,
      ...(pagination.sortBy ? { sortBy: pagination.sortBy } : {}),
      ...(statusFilterTasks ? { status: statusFilterTasks } : {}),
    });
    res.json({ success: true, data: result });
  })
);

contactTasksRouter.post(
  '/:contactId/tasks',
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const params = parseOrRespond(ContactIdParamSchema, req.params, res);
    if (!params) {
      return;
    }

    const body = parseOrRespond(CreateContactTaskPayloadSchema, req.body, res);
    if (!body) {
      return;
    }

    const tenantId = req.user!.tenantId;
    const task = await createContactTask({ tenantId, contactId: params.contactId, payload: body });
    res.status(201).json({ success: true, data: task });
  })
);

contactTasksRouter.patch(
  '/tasks/:taskId',
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const params = parseOrRespond(TaskIdParamSchema, req.params, res);
    if (!params) {
      return;
    }

    const body = parseOrRespond(UpdateContactTaskPayloadSchema, req.body, res);
    if (!body) {
      return;
    }

    const tenantId = req.user!.tenantId;
    const task = await updateContactTask({ tenantId, taskId: params.taskId, payload: body });

    if (!task) {
      throw new NotFoundError('Task', params.taskId);
    }

    res.json({ success: true, data: task });
  })
);

export { contactTasksRouter };
