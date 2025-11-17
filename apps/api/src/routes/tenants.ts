import { Router, type Request } from 'express';
import { body, param } from 'express-validator';
import { ForbiddenError } from '@ticketz/core';

import { prisma } from '../lib/prisma';
import { requireTenant } from '../middleware/auth';
import { asyncHandler } from '../middleware/error-handler';
import { validateRequest } from '../middleware/validation';
import { ensureTenantParamAccess, resolveRequestTenantId } from '../services/tenant-service';

const router = Router();

router.use(requireTenant);

const formatTenantResponse = (tenant: {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  settings: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: tenant.id,
  name: tenant.name,
  slug: tenant.slug,
  isActive: tenant.isActive,
  settings: tenant.settings,
  createdAt: tenant.createdAt,
  updatedAt: tenant.updatedAt,
});

const hasPermission = (req: Request, permission: string): boolean => {
  return Array.isArray(req.user?.permissions) && req.user!.permissions.includes(permission);
};

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const canReadAll = hasPermission(req, 'tenants:read');

    const tenants = await prisma.tenant.findMany({
      where: canReadAll ? {} : { id: tenantId },
      orderBy: { createdAt: 'asc' },
    });

    res.json({
      success: true,
      data: tenants.map(formatTenantResponse),
    });
  })
);

router.patch(
  '/:tenantId',
  param('tenantId').isString().trim().notEmpty(),
  body('name').optional().isString().trim().isLength({ min: 3 }).withMessage('Nome deve ter ao menos 3 caracteres.'),
  body('isActive').optional().isBoolean(),
  body('settings').optional().isObject(),
  validateRequest,
  asyncHandler(async (req, res) => {
    if (!hasPermission(req, 'tenants:write')) {
      throw new ForbiddenError('Permissão tenants:write necessária para alterar tenants.');
    }

    const tenantId = ensureTenantParamAccess(req, req.params.tenantId);

    const data: Record<string, unknown> = {};
    if (typeof req.body.name === 'string') {
      data.name = req.body.name.trim();
    }
    if (typeof req.body.isActive === 'boolean') {
      data.isActive = req.body.isActive;
    }
    if (req.body.settings && typeof req.body.settings === 'object') {
      data.settings = req.body.settings;
    }

    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data,
    });

    res.json({
      success: true,
      data: formatTenantResponse(updated),
    });
  })
);

export const tenantsRouter = router;
