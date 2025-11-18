import { translateLegacyAgreementFields } from '@ticketz/shared';

import type { Request, Response } from 'express';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';

import { asyncHandler } from '../middleware/error-handler';
import { requireTenant } from '../middleware/auth';
import {
  AgreementListQuerySchema,
  AgreementRateSchema,
  AgreementWindowSchema,
  CreateAgreementSchema,
  UpdateAgreementSchema,
} from '../modules/agreements/validators';
import { AgreementsService, type AgreementAuditMetadata } from '../modules/agreements/service';
import { respondError, respondSuccess, handleServiceError } from './agreements.response';
import { AgreementsImportService } from '../services/agreements-import-service';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();
const agreementsService = new AgreementsService();
const agreementsImportService = new AgreementsImportService({ agreementsService });

const ensureTenantUser = (req: Request, res: Response) => {
  if (!req.user || !req.user.tenantId) {
    res.status(403).json({
      data: null,
      meta: { requestId: res.locals.requestId ?? null },
      error: {
        code: 'TENANT_REQUIRED',
        message: 'Tenant obrigatório para acessar convênios.',
      },
    });
    return null;
  }

  return req.user;
};

const buildActor = (req: Request) => {
  if (!req.user) {
    return null;
  }

  return {
    id: req.user.id,
    name: req.user.name ?? req.user.email ?? 'Usuário',
  };
};

const extractAuditMeta = (meta: unknown): AgreementAuditMetadata | null => {
  if (!meta || typeof meta !== 'object') {
    return null;
  }

  const auditCandidate = (meta as { audit?: unknown }).audit;
  if (!auditCandidate || typeof auditCandidate !== 'object') {
    return null;
  }

  const audit: AgreementAuditMetadata = {};
  if (typeof (auditCandidate as { actor?: unknown }).actor === 'string') {
    audit.actor = ((auditCandidate as { actor: string }).actor || '').trim();
  }
  if (typeof (auditCandidate as { actorRole?: unknown }).actorRole === 'string') {
    audit.actorRole = ((auditCandidate as { actorRole: string }).actorRole || '').trim();
  }
  if (typeof (auditCandidate as { note?: unknown }).note === 'string') {
    audit.note = ((auditCandidate as { note: string }).note || '').trim();
  }

  return Object.keys(audit).length ? audit : null;
};

const extractAgreementEnvelope = (body: unknown): { data: unknown; meta: unknown } => {
  if (body && typeof body === 'object' && 'data' in body) {
    const envelope = body as { data?: unknown; meta?: unknown };
    return { data: envelope.data ?? {}, meta: envelope.meta ?? null };
  }

  return { data: body ?? {}, meta: null };
};

const parsePayloadWithEnvelope = <TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  body: unknown,
  options: { transform?: (data: unknown) => unknown } = {}
): { payload: z.infer<TSchema>; audit: AgreementAuditMetadata | null } => {
  const { data, meta } = extractAgreementEnvelope(body);
  const source = options.transform ? options.transform(data) : data;
  const payload = schema.parse(source);
  const audit = extractAuditMeta(meta);
  return { payload, audit };
};

const parseAgreementPayload = <TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  body: unknown
): { payload: z.infer<TSchema>; audit: AgreementAuditMetadata | null } =>
  parsePayloadWithEnvelope(schema, body);

const parseAgreementPayloadWithLegacy = <TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  body: unknown
): { payload: z.infer<TSchema>; audit: AgreementAuditMetadata | null } =>
  parsePayloadWithEnvelope(schema, body, { transform: translateLegacyAgreementFields });

const extractAuditFromBody = (body: unknown): AgreementAuditMetadata | null => {
  const { meta } = extractAgreementEnvelope(body);
  return extractAuditMeta(meta);
};

router.get(
  '/v1/agreements',
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const user = ensureTenantUser(req, res);
    if (!user) {
      return;
    }

    try {
      const query = AgreementListQuerySchema.parse(req.query ?? {});
      const result = await agreementsService.listAgreements(user.tenantId, query, query);
      respondSuccess(res, 200, result.items, {
        pagination: {
          page: result.page,
          limit: result.limit,
          totalItems: result.total,
          totalPages: result.totalPages,
          hasNext: result.page < result.totalPages,
          hasPrevious: result.page > 1,
        },
      });
    } catch (error) {
      handleServiceError(res, error, { tenantId: user.tenantId, action: 'list' });
    }
  })
);

router.post(
  '/v1/agreements',
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const user = ensureTenantUser(req, res);
    if (!user) {
      return;
    }

    try {
      const { payload, audit } = parseAgreementPayloadWithLegacy(
        CreateAgreementSchema,
        req.body ?? {}
      );
      const agreement = await agreementsService.createAgreement(
        user.tenantId,
        payload,
        buildActor(req),
        audit
      );
      respondSuccess(res, 201, agreement);
    } catch (error) {
      handleServiceError(res, error, { tenantId: user.tenantId, action: 'create' });
    }
  })
);

router.get(
  '/v1/agreements/:agreementId',
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const user = ensureTenantUser(req, res);
    if (!user) {
      return;
    }

    const agreementId = (req.params.agreementId ?? '').trim();
    if (!agreementId) {
      respondError(res, 400, 'AGREEMENT_ID_REQUIRED', 'Identificador do convênio é obrigatório.');
      return;
    }

    try {
      const agreement = await agreementsService.getAgreement(user.tenantId, agreementId);
      if (!agreement) {
        respondError(res, 404, 'AGREEMENT_NOT_FOUND', 'Convênio não encontrado.');
        return;
      }

      const history = await agreementsService.listHistory(user.tenantId, agreementId, 25);
      respondSuccess(res, 200, { agreement, history });
    } catch (error) {
      handleServiceError(res, error, { tenantId: user.tenantId, agreementId, action: 'get' });
    }
  })
);

const updateAgreementHandler = asyncHandler(async (req: Request, res: Response) => {
  const user = ensureTenantUser(req, res);
  if (!user) {
    return;
  }

  const agreementId = (req.params.agreementId ?? '').trim();
  if (!agreementId) {
    respondError(res, 400, 'AGREEMENT_ID_REQUIRED', 'Identificador do convênio é obrigatório.');
    return;
  }

  try {
    const { payload, audit } = parseAgreementPayloadWithLegacy(
      UpdateAgreementSchema,
      req.body ?? {}
    );
    const agreement = await agreementsService.updateAgreement(
      user.tenantId,
      agreementId,
      payload,
      buildActor(req),
      audit
    );
    respondSuccess(res, 200, agreement);
  } catch (error) {
    handleServiceError(res, error, { tenantId: user.tenantId, agreementId, action: 'update' });
  }
});

router.patch('/v1/agreements/:agreementId', requireTenant, updateAgreementHandler);

// Mantemos o endpoint via PUT para compatibilidade retroativa até que todos os clientes usem PATCH.
router.put('/v1/agreements/:agreementId', requireTenant, updateAgreementHandler);

router.delete(
  '/v1/agreements/:agreementId',
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const user = ensureTenantUser(req, res);
    if (!user) {
      return;
    }

    const agreementId = (req.params.agreementId ?? '').trim();
    if (!agreementId) {
      respondError(res, 400, 'AGREEMENT_ID_REQUIRED', 'Identificador do convênio é obrigatório.');
      return;
    }

    const audit = extractAuditFromBody(req.body ?? {});

    try {
      const agreement = await agreementsService.archiveAgreement(
        user.tenantId,
        agreementId,
        buildActor(req),
        audit
      );
      respondSuccess(res, 200, agreement);
    } catch (error) {
      handleServiceError(res, error, { tenantId: user.tenantId, agreementId, action: 'archive' });
    }
  })
);

router.post(
  '/v1/agreements/:agreementId/windows',
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const user = ensureTenantUser(req, res);
    if (!user) {
      return;
    }

    const agreementId = (req.params.agreementId ?? '').trim();
    if (!agreementId) {
      respondError(res, 400, 'AGREEMENT_ID_REQUIRED', 'Identificador do convênio é obrigatório.');
      return;
    }

    try {
      const { payload, audit } = parsePayloadWithEnvelope(AgreementWindowSchema, req.body ?? {});
      const window = await agreementsService.upsertWindow(
        user.tenantId,
        agreementId,
        payload,
        buildActor(req),
        audit
      );
      respondSuccess(res, payload.id ? 200 : 201, window);
    } catch (error) {
      handleServiceError(res, error, { tenantId: user.tenantId, agreementId, action: 'window-upsert' });
    }
  })
);

router.delete(
  '/v1/agreements/:agreementId/windows/:windowId',
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const user = ensureTenantUser(req, res);
    if (!user) {
      return;
    }

    const agreementId = (req.params.agreementId ?? '').trim();
    const windowId = (req.params.windowId ?? '').trim();
    if (!agreementId || !windowId) {
      respondError(res, 400, 'WINDOW_ID_REQUIRED', 'Identificador da janela é obrigatório.');
      return;
    }

    const audit = extractAuditFromBody(req.body ?? {});

    try {
      await agreementsService.removeWindow(user.tenantId, agreementId, windowId, buildActor(req), audit);
      respondSuccess(res, 200, null);
    } catch (error) {
      handleServiceError(res, error, { tenantId: user.tenantId, agreementId, windowId, action: 'window-delete' });
    }
  })
);

router.post(
  '/v1/agreements/:agreementId/rates',
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const user = ensureTenantUser(req, res);
    if (!user) {
      return;
    }

    const agreementId = (req.params.agreementId ?? '').trim();
    if (!agreementId) {
      respondError(res, 400, 'AGREEMENT_ID_REQUIRED', 'Identificador do convênio é obrigatório.');
      return;
    }

    try {
      const { payload, audit } = parsePayloadWithEnvelope(AgreementRateSchema, req.body ?? {});
      const rate = await agreementsService.upsertRate(
        user.tenantId,
        agreementId,
        payload,
        buildActor(req),
        audit
      );
      respondSuccess(res, payload.id ? 200 : 201, rate);
    } catch (error) {
      handleServiceError(res, error, { tenantId: user.tenantId, agreementId, action: 'rate-upsert' });
    }
  })
);

router.delete(
  '/v1/agreements/:agreementId/rates/:rateId',
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const user = ensureTenantUser(req, res);
    if (!user) {
      return;
    }

    const agreementId = (req.params.agreementId ?? '').trim();
    const rateId = (req.params.rateId ?? '').trim();
    if (!agreementId || !rateId) {
      respondError(res, 400, 'RATE_ID_REQUIRED', 'Identificador da taxa é obrigatório.');
      return;
    }

    const audit = extractAuditFromBody(req.body ?? {});

    try {
      await agreementsService.removeRate(user.tenantId, agreementId, rateId, buildActor(req), audit);
      respondSuccess(res, 200, null);
    } catch (error) {
      handleServiceError(res, error, { tenantId: user.tenantId, agreementId, rateId, action: 'rate-delete' });
    }
  })
);

router.post(
  '/v1/agreements/:agreementId/import',
  requireTenant,
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    const user = ensureTenantUser(req, res);
    if (!user) {
      return;
    }

    const agreementId = (req.params.agreementId ?? '').trim();
    if (!agreementId) {
      respondError(res, 400, 'AGREEMENT_ID_REQUIRED', 'Identificador do convênio é obrigatório.');
      return;
    }

    const file = req.file;
    if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
      respondError(res, 400, 'IMPORT_FILE_REQUIRED', 'Arquivo de importação é obrigatório.');
      return;
    }

    try {
      const job = await agreementsImportService.enqueueImport({
        tenantId: user.tenantId,
        agreementId,
        actor: buildActor(req),
        file: {
          buffer: file.buffer,
          originalName: file.originalname ?? null,
          size: typeof file.size === 'number' ? file.size : null,
          mimeType: file.mimetype ?? null,
        },
        origin: 'agreements-api',
      });
      respondSuccess(res, 202, job);
    } catch (error) {
      handleServiceError(res, error, { tenantId: user.tenantId, agreementId, action: 'import' });
    }
  })
);

export { router as agreementsRouter };
