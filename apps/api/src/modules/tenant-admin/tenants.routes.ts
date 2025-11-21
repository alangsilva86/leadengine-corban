import { Router, type Request, type Response } from 'express';
import { ZodError, type ZodSchema } from 'zod';

import { asyncHandler } from '../../middleware/error-handler';
import { buildValidationError } from '../../utils/http-validation';
import { TenantAdminService, type TenantAdminServicePort } from './tenant.service';
import {
  CreateTenantSchema,
  ListTenantsQuerySchema,
  TenantIdParamSchema,
  ToggleTenantSchema,
  UpdateTenantSchema,
} from './tenant.validators';

const parseOrFail = <T>(schema: ZodSchema<T>, payload: unknown): T => {
  try {
    return schema.parse(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      throw buildValidationError(error.issues);
    }

    throw error;
  }
};

export const createTenantAdminRouter = (service: TenantAdminServicePort): Router => {
  const router = Router();

  router.post(
    '/',
    asyncHandler(async (req: Request, res: Response) => {
      const body = parseOrFail(CreateTenantSchema, req.body);
      const tenant = await service.createTenant(body);
      res.status(201).json({ success: true, data: tenant });
    })
  );

  router.get(
    '/',
    asyncHandler(async (req: Request, res: Response) => {
      const query = parseOrFail(ListTenantsQuerySchema, req.query);
      const result = await service.listTenants(query);
      res.json({ success: true, data: result });
    })
  );

  router.get(
    '/:tenantId',
    asyncHandler(async (req: Request, res: Response) => {
      const params = parseOrFail(TenantIdParamSchema, req.params);
      const tenant = await service.getTenantById(params.tenantId);
      res.json({ success: true, data: tenant });
    })
  );

  router.patch(
    '/:tenantId',
    asyncHandler(async (req: Request, res: Response) => {
      const params = parseOrFail(TenantIdParamSchema, req.params);
      const body = parseOrFail(UpdateTenantSchema, req.body);
      const tenant = await service.updateTenant(params.tenantId, body);
      res.json({ success: true, data: tenant });
    })
  );

  router.patch(
    '/:tenantId/toggle-active',
    asyncHandler(async (req: Request, res: Response) => {
      const params = parseOrFail(TenantIdParamSchema, req.params);
      const body = parseOrFail(ToggleTenantSchema, req.body);
      const tenant = await service.toggleTenantActive(params.tenantId, body.isActive);
      res.json({ success: true, data: tenant });
    })
  );

  return router;
};

export const tenantAdminRouterFactory = (): Router =>
  createTenantAdminRouter(new TenantAdminService());
