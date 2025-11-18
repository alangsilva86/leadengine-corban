import { Router, type Request, type Response } from 'express';
import { ZodError, type ZodSchema } from 'zod';

import { asyncHandler } from '../../middleware/error-handler';
import { respondWithValidationError } from '../../utils/http-validation';
import { TenantAdminService } from './tenant.service';
import {
  CreateTenantSchema,
  ListTenantsQuerySchema,
  TenantIdParamSchema,
  ToggleTenantSchema,
  UpdateTenantSchema,
} from './tenant.validators';

const service = new TenantAdminService();

const parseOrFail = <T>(schema: ZodSchema<T>, payload: unknown, res: Response): T | null => {
  try {
    return schema.parse(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      respondWithValidationError(res, error.issues);
      return null;
    }

    throw error;
  }
};

export const createTenantAdminRouter = (): Router => {
  const router = Router();

  router.post(
    '/',
    asyncHandler(async (req: Request, res: Response) => {
      const body = parseOrFail(CreateTenantSchema, req.body, res);
      if (!body) {
        return;
      }

      const tenant = await service.createTenant(body);
      res.status(201).json({ success: true, data: tenant });
    })
  );

  router.get(
    '/',
    asyncHandler(async (req: Request, res: Response) => {
      const query = parseOrFail(ListTenantsQuerySchema, req.query, res);
      if (!query) {
        return;
      }

      const result = await service.listTenants(query);
      res.json({ success: true, data: result });
    })
  );

  router.get(
    '/:tenantId',
    asyncHandler(async (req: Request, res: Response) => {
      const params = parseOrFail(TenantIdParamSchema, req.params, res);
      if (!params) {
        return;
      }

      const tenant = await service.getTenantById(params.tenantId);
      res.json({ success: true, data: tenant });
    })
  );

  router.patch(
    '/:tenantId',
    asyncHandler(async (req: Request, res: Response) => {
      const params = parseOrFail(TenantIdParamSchema, req.params, res);
      if (!params) {
        return;
      }

      const body = parseOrFail(UpdateTenantSchema, req.body, res);
      if (!body) {
        return;
      }

      const tenant = await service.updateTenant(params.tenantId, body);
      res.json({ success: true, data: tenant });
    })
  );

  router.patch(
    '/:tenantId/toggle-active',
    asyncHandler(async (req: Request, res: Response) => {
      const params = parseOrFail(TenantIdParamSchema, req.params, res);
      if (!params) {
        return;
      }

      const body = parseOrFail(ToggleTenantSchema, req.body, res);
      if (!body) {
        return;
      }

      const tenant = await service.toggleTenantActive(params.tenantId, body.isActive);
      res.json({ success: true, data: tenant });
    })
  );

  return router;
};

export const tenantAdminRouter = createTenantAdminRouter();
