import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { Request, Response } from 'express';
import { Router } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';

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
import { AgreementsService } from '../modules/agreements/service';
import { formatZodIssues } from '../utils/http-validation';
import { incrementAgreementImportEnqueued } from '../lib/metrics';
import { processAgreementImportJobs } from '../workers/agreements-import';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();
const agreementsService = new AgreementsService();

const TMP_DIR = path.join(process.cwd(), 'tmp', 'agreements-import');

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
      ...meta,
    },
    error: null,
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

  const status = typeof (error as { status?: number }).status === 'number' ? (error as { status: number }).status : 500;
  const code = typeof (error as { code?: string }).code === 'string' ? (error as { code: string }).code : 'AGREEMENTS_ERROR';
  const message = error instanceof Error ? error.message : 'Erro inesperado.';

  logger.error('[/agreements] operation failed', { ...context, error });
  respondError(res, status, code, message);
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
          total: result.total,
          totalPages: result.totalPages,
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
      const payload = CreateAgreementSchema.parse(req.body ?? {});
      const agreement = await agreementsService.createAgreement(user.tenantId, payload, buildActor(req));
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

router.put(
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
      const payload = UpdateAgreementSchema.parse(req.body ?? {});
      const agreement = await agreementsService.updateAgreement(user.tenantId, agreementId, payload, buildActor(req));
      respondSuccess(res, 200, agreement);
    } catch (error) {
      handleServiceError(res, error, { tenantId: user.tenantId, agreementId, action: 'update' });
    }
  })
);

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

    try {
      const agreement = await agreementsService.archiveAgreement(user.tenantId, agreementId, buildActor(req));
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
      const payload = AgreementWindowSchema.parse(req.body ?? {});
      const window = await agreementsService.upsertWindow(user.tenantId, agreementId, payload, buildActor(req));
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

    try {
      await agreementsService.removeWindow(user.tenantId, agreementId, windowId, buildActor(req));
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
      const payload = AgreementRateSchema.parse(req.body ?? {});
      const rate = await agreementsService.upsertRate(user.tenantId, agreementId, payload, buildActor(req));
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

    try {
      await agreementsService.removeRate(user.tenantId, agreementId, rateId, buildActor(req));
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
