import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { Prisma } from '@prisma/client';
import { translateLegacyAgreementFields } from '@ticketz/shared';

import type { Request, Response } from 'express';
import { Router } from 'express';
import multer from 'multer';
import { ZodError, z } from 'zod';

import { logger } from '../config/logger';
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
import { formatZodIssues } from '../utils/http-validation';
import { incrementAgreementImportEnqueued } from '../lib/metrics';
import { processAgreementImportJobs } from '../workers/agreements-import';
import { DatabaseDisabledError } from '../lib/prisma';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();
const agreementsService = new AgreementsService();

const TMP_DIR = path.join(process.cwd(), 'tmp', 'agreements-import');

const STORAGE_DISABLED_ERROR_CODES = new Set(['DATABASE_DISABLED', 'STORAGE_DATABASE_DISABLED']);
const STORAGE_UNAVAILABLE_PRISMA_CODES = new Set([
  'P1000',
  'P1001',
  'P1002',
  'P1003',
  'P1008',
  'P1009',
  'P1010',
  'P1011',
  'P1012',
  'P1013',
  'P1014',
  'P1015',
  'P1016',
  'P1017',
  'P2000',
  'P2001',
  'P2002',
  'P2003',
  'P2004',
  'P2005',
  'P2006',
  'P2007',
  'P2008',
  'P2009',
  'P2010',
  'P2021',
  'P2022',
  'P2023',
  'P2024',
]);

const readErrorCode = (error: unknown): string | null => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string'
  ) {
    return (error as { code: string }).code;
  }
  return null;
};

const isStorageDisabledError = (error: unknown): boolean => {
  if (error instanceof DatabaseDisabledError) {
    return true;
  }

  const code = readErrorCode(error);
  return Boolean(code && STORAGE_DISABLED_ERROR_CODES.has(code));
};

const resolveStorageUnavailableError = (error: unknown): { prismaCode?: string } | null => {
  if (
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientRustPanicError
  ) {
    return {};
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (STORAGE_UNAVAILABLE_PRISMA_CODES.has(error.code)) {
      return { prismaCode: error.code };
    }
    return null;
  }

  const code = readErrorCode(error);
  if (code && STORAGE_UNAVAILABLE_PRISMA_CODES.has(code)) {
    return { prismaCode: code };
  }

  return null;
};

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

const respondSuccess = (res: Response, status: number, data: unknown, meta: Record<string, unknown> = {}) => {
  res.status(status).json({
    data,
    meta: {
      requestId: res.locals.requestId ?? null,
      generatedAt: new Date().toISOString(),
      ...meta,
    },
  });
};

const respondError = (
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>
) => {
  res.status(status).json({
    data: null,
    meta: { requestId: res.locals.requestId ?? null },
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  });
};

const handleZodError = (res: Response, error: ZodError) => {
  const issues = formatZodIssues(error.issues);
  respondError(res, 400, 'VALIDATION_ERROR', 'Requisição inválida.', { errors: issues });
};

const handleServiceError = (res: Response, error: unknown, context: Record<string, unknown> = {}) => {
  if (error instanceof ZodError) {
    handleZodError(res, error);
    return;
  }

  if (isStorageDisabledError(error)) {
    logger.warn('[/agreements] storage disabled', { ...context });
    respondError(
      res,
      503,
      'AGREEMENTS_STORAGE_DISABLED',
      'Persistência de convênios desabilitada neste ambiente. Configure DATABASE_URL ou habilite o tenant demo.'
    );
    return;
  }

  const storageError = resolveStorageUnavailableError(error);
  if (storageError) {
    logger.error('[/agreements] storage unavailable', { ...context, error });
    respondError(
      res,
      503,
      'AGREEMENTS_STORAGE_UNAVAILABLE',
      'Banco de convênios indisponível. Execute as migrações pendentes ou verifique a conexão com o banco.',
      storageError.prismaCode ? { prismaCode: storageError.prismaCode } : undefined
    );
    return;
  }

  const status = typeof (error as { status?: number }).status === 'number' ? (error as { status: number }).status : 500;
  const code = typeof (error as { code?: string }).code === 'string' ? (error as { code: string }).code : 'AGREEMENTS_ERROR';
  const message = error instanceof Error ? error.message : 'Erro inesperado.';

  logger.error('[/agreements] operation failed', { ...context, error });
  respondError(res, status, code, message);
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
      await fs.mkdir(TMP_DIR, { recursive: true });
      const checksum = createHash('sha256').update(file.buffer).digest('hex');
      const tempFileName = `${Date.now()}-${randomUUID()}-${file.originalname || 'agreements-import.tmp'}`;
      const tempFilePath = path.join(TMP_DIR, tempFileName);
      await fs.writeFile(tempFilePath, file.buffer);

      const job = await agreementsService.requestImport(user.tenantId, agreementId, {
        agreementId,
        checksum,
        fileName: file.originalname || 'agreements-import.csv',
        tempFilePath,
        size: typeof file.size === 'number' ? file.size : file.buffer.length,
        mimeType: file.mimetype ?? 'application/octet-stream',
      });

      incrementAgreementImportEnqueued({
        tenantId: user.tenantId,
        agreementId,
        origin: 'agreements-api',
      });

      setImmediate(() => {
        processAgreementImportJobs({ limit: 1 }).catch((error) => {
          logger.error('[/agreements] import worker failed', {
            tenantId: user.tenantId,
            agreementId,
            jobId: job.id,
            error,
          });
        });
      });

      respondSuccess(res, 202, job);
    } catch (error) {
      handleServiceError(res, error, { tenantId: user.tenantId, agreementId, action: 'import' });
    }
  })
);

export { router as agreementsRouter };
