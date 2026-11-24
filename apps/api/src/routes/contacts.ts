import { Router, type Request, type Response } from 'express';
import { z, ZodError } from 'zod';

import {
  BulkContactsActionSchema,
  CreateContactInteractionPayloadSchema,
  CreateContactPayloadSchema,
  MergeContactsDTOSchema,
  UpdateContactPayloadSchema,
} from '@ticketz/core';
import type { ContactFilters } from '@ticketz/core';
import {
  applyBulkContactsAction,
  createContact,
  getContactById,
  listContactInteractions,
  listContactTags,
  listContacts,
  logContactInteraction,
  mergeContacts,
  updateContact,
} from '@ticketz/storage';

import { asyncHandler } from '../middleware/error-handler';
import { requireTenant } from '../middleware/auth';
import { requireRoles } from '../middleware/policies';
import { respondWithValidationError } from '../utils/http-validation';
import { ConflictError, NotFoundError } from '@ticketz/core';
import {
  ContactIdParamSchema,
  ContactResourceIdSchema,
  ListContactsQuerySchema,
  PaginationQuerySchema,
  parseOrRespond,
} from './contacts/schemas';
import { normalizePaginationQuery } from '../utils/pagination';

const router: Router = Router();
const mergeContactsBody = MergeContactsDTOSchema.omit({ tenantId: true }).extend({
  targetId: ContactResourceIdSchema,
  sourceIds: z.array(ContactResourceIdSchema).min(1),
});
const bulkContactsBody = BulkContactsActionSchema.omit({ tenantId: true }).extend({
  contactIds: z.array(ContactResourceIdSchema).min(1),
});

router.get(
  '/',
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const query = parseOrRespond(ListContactsQuerySchema, req.query, res);
    if (!query) {
      return;
    }

    const tenantId = req.user!.tenantId;
    const {
      page,
      limit,
      sortBy,
      sortOrder,
      search,
      status,
      tags,
      lastInteractionFrom,
      lastInteractionTo,
      hasOpenTickets,
      isBlocked,
      hasWhatsapp,
    } = query;

    const pagination = normalizePaginationQuery({ page, limit, sortBy, sortOrder });

    const statusFilter = Array.isArray(status) && status.length > 0 ? status : undefined;

    const filters: ContactFilters = {};
    const trimmedSearch = search?.trim();
    if (trimmedSearch) {
      filters.search = trimmedSearch;
    }
    if (statusFilter) {
      filters.status = statusFilter;
    }
    if (tags && tags.length > 0) {
      filters.tags = tags;
    }
    if (lastInteractionFrom) {
      filters.lastInteractionFrom = lastInteractionFrom;
    }
    if (lastInteractionTo) {
      filters.lastInteractionTo = lastInteractionTo;
    }
    if (typeof hasOpenTickets === 'boolean') {
      filters.hasOpenTickets = hasOpenTickets;
    }
    if (typeof isBlocked === 'boolean') {
      filters.isBlocked = isBlocked;
    }
    if (typeof hasWhatsapp === 'boolean') {
      filters.hasWhatsapp = hasWhatsapp;
    }

    const response = await listContacts(
      tenantId,
      pagination,
      Object.keys(filters).length > 0 ? filters : undefined
    );

    res.json({ success: true, data: response });
  })
);

router.post(
  '/',
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const body = parseOrRespond(CreateContactPayloadSchema, req.body, res);
    if (!body) {
      return;
    }

    const tenantId = req.user!.tenantId;

    try {
      const contact = await createContact({ tenantId, payload: body });
      res.status(201).json({ success: true, data: contact });
    } catch (error) {
      if (error instanceof ZodError) {
        respondWithValidationError(res, error.issues);
        return;
      }

      if (error instanceof ConflictError) {
        throw error;
      }

      throw error;
    }
  })
);

router.post(
  '/merge',
  requireTenant,
  requireRoles('ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const payload = parseOrRespond(mergeContactsBody, req.body, res);
    if (!payload) {
      return;
    }

    const tenantId = req.user!.tenantId;
    const result = await mergeContacts({
      tenantId,
      targetId: payload.targetId,
      sourceIds: payload.sourceIds,
      preserve: payload.preserve ?? {},
    });

    if (!result) {
      throw new NotFoundError('Contact', payload.targetId);
    }

    res.json({ success: true, data: result });
  })
);

router.get(
  '/tags',
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.tenantId;
    const tags = await listContactTags(tenantId);
    res.json({ success: true, data: tags });
  })
);

router.get(
  '/:contactId',
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const params = parseOrRespond(ContactIdParamSchema, req.params, res);
    if (!params) {
      return;
    }

    const tenantId = req.user!.tenantId;
    const contact = await getContactById(tenantId, params.contactId);

    if (!contact) {
      throw new NotFoundError('Contact', params.contactId);
    }

    res.json({ success: true, data: contact });
  })
);

router.patch(
  '/:contactId',
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const params = parseOrRespond(ContactIdParamSchema, req.params, res);
    if (!params) {
      return;
    }

    const body = parseOrRespond(UpdateContactPayloadSchema, req.body, res);
    if (!body) {
      return;
    }

    const tenantId = req.user!.tenantId;
    const contact = await updateContact({ tenantId, contactId: params.contactId, payload: body });

    if (!contact) {
      throw new NotFoundError('Contact', params.contactId);
    }

    res.json({ success: true, data: contact });
  })
);

router.post(
  '/actions/bulk',
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const payload = parseOrRespond(bulkContactsBody, req.body, res);
    if (!payload) {
      return;
    }

    const tenantId = req.user!.tenantId;
    const contacts = await applyBulkContactsAction({ tenantId, ...payload });
    res.json({ success: true, data: contacts });
  })
);

router.post(
  '/actions/whatsapp',
  requireTenant,
  (_req, res) => res.status(409).json({ success: false,
    error: { code: 'CAMPAIGN_NOT_HOMOLOGATED', message: 'Disparos em lote dependem de um canal e modelos homologados.' } }),
);

router.get(
  '/:contactId/interactions',
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const params = parseOrRespond(ContactIdParamSchema, req.params, res);
    if (!params) {
      return;
    }

    const query = parseOrRespond(PaginationQuerySchema, req.query, res);
    if (!query) {
      return;
    }

    const tenantId = req.user!.tenantId;
    const pagination = normalizePaginationQuery(query);
    const result = await listContactInteractions({
      tenantId,
      contactId: params.contactId,
      ...pagination,
    });
    res.json({ success: true, data: result });
  })
);

router.post(
  '/:contactId/interactions',
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const params = parseOrRespond(ContactIdParamSchema, req.params, res);
    if (!params) {
      return;
    }

    const body = parseOrRespond(CreateContactInteractionPayloadSchema, req.body, res);
    if (!body) {
      return;
    }

    const tenantId = req.user!.tenantId;
    const payloadWithDirection = {
      ...body,
      direction: body.direction ?? 'INBOUND',
    };
    const interaction = await logContactInteraction({
      tenantId,
      contactId: params.contactId,
      payload: payloadWithDirection,
    });
    res.status(201).json({ success: true, data: interaction });
  })
);

export { router as contactsRouter };
