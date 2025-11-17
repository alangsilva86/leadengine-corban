import { Router, type Request, type Response } from 'express';
import { ZodError } from 'zod';

import {
  BulkContactsActionSchema,
  CreateContactInteractionPayloadSchema,
  CreateContactPayloadSchema,
  MergeContactsDTOSchema,
  UpdateContactPayloadSchema,
  WhatsappActionPayloadSchema,
} from '@ticketz/core';
import type { ContactFilters } from '@ticketz/core';
import type { NormalizedMessagePayload } from '@ticketz/contracts';
import {
  applyBulkContactsAction,
  createContact,
  findContactsByIds,
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
import { respondWithValidationError } from '../utils/http-validation';
import { sendToContact } from '../services/ticket-service';
import { ConflictError, NotFoundError } from '@ticketz/core';
import {
  ContactIdParamSchema,
  ListContactsQuerySchema,
  PaginationQuerySchema,
  parseOrRespond,
} from './contacts/schemas';

type NormalizePayloadFn = (payload: { type: string; [key: string]: unknown }) => NormalizedMessagePayload;

let normalizePayloadCached: NormalizePayloadFn | null = null;
const loadNormalizePayload = async (): Promise<NormalizePayloadFn> => {
  if (!normalizePayloadCached) {
    const mod = await import('@ticketz/contracts');
    normalizePayloadCached = mod.normalizePayload as NormalizePayloadFn;
  }
  return normalizePayloadCached;
};

const router: Router = Router();

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

    const pagination: { page?: number; limit?: number; sortBy?: string; sortOrder?: 'asc' | 'desc' } = {};
    if (typeof page === 'number' && Number.isFinite(page)) {
      pagination.page = page;
    }
    if (typeof limit === 'number' && Number.isFinite(limit)) {
      pagination.limit = limit;
    }
    if (typeof sortBy === 'string' && sortBy.trim()) {
      pagination.sortBy = sortBy.trim();
    }
    if (sortOrder) {
      pagination.sortOrder = sortOrder;
    }

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
  asyncHandler(async (req: Request, res: Response) => {
    const payload = parseOrRespond(MergeContactsDTOSchema.omit({ tenantId: true }), req.body, res);
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
    const payload = parseOrRespond(BulkContactsActionSchema.omit({ tenantId: true }), req.body, res);
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
  asyncHandler(async (req: Request, res: Response) => {
    const payload = parseOrRespond(WhatsappActionPayloadSchema, req.body, res);
    if (!payload) {
      return;
    }

    const tenantId = req.user!.tenantId;
    const operatorId = req.user!.id;

    const contacts = await findContactsByIds(tenantId, payload.contactIds);

    if (!contacts.length) {
      throw new NotFoundError('Contact', payload.contactIds.join(','));
    }

    const normalizePayload = await loadNormalizePayload();
    const responses = [] as Array<{ contactId: string; status: string }>;

    for (const contact of contacts) {
      const resolvedText = payload.message?.text ?? payload.template?.name ?? undefined;

      if (!resolvedText) {
        throw new ConflictError('Whatsapp action requires a message payload.');
      }

      const normalizedPayload = normalizePayload({
        type: 'text',
        text: resolvedText,
      });

      const response = await sendToContact({
        tenantId,
        operatorId,
        contactId: contact.id,
        payload: normalizedPayload,
      });

      responses.push({ contactId: contact.id, status: response.status });
    }

    res.status(202).json({ success: true, data: { results: responses } });
  })
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
    const result = await listContactInteractions({
      tenantId,
      contactId: params.contactId,
      page: pageValue,
      limit: limitValue,
      sortOrder: sortOrderValue,
      ...(pagination.sortBy ? { sortBy: pagination.sortBy } : {}),
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
