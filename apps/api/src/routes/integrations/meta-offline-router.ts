import { Router, type Request, type Response } from 'express';
import { body } from 'express-validator';

import { asyncHandler } from '../../middleware/error-handler';
import { requireTenant } from '../../middleware/auth';
import { validateRequest } from '../../middleware/validation';
import {
  loadMetaOfflineConfig,
  upsertMetaOfflineConfig,
  toPublicMetaOfflineConfig,
} from '../../services/meta-offline-config';

const router = Router();

const ensureTenantId = (req: Request): string => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) {
    const error = new Error('Tenant não autenticado.');
    (error as Error & { status?: number }).status = 401;
    throw error;
  }
  return tenantId;
};

const configValidators = [
  body('offlineEventSetId').optional({ nullable: true }).isString().trim(),
  body('pixelId').optional({ nullable: true }).isString().trim(),
  body('businessId').optional({ nullable: true }).isString().trim(),
  body('accessToken').optional({ nullable: true }).isString(),
  body('appId').optional({ nullable: true }).isString().trim(),
  body('appSecret').optional({ nullable: true }).isString(),
  body('actionSource').optional({ nullable: true }).isString().trim(),
  body('eventName').optional({ nullable: true }).isString().trim(),
  body('reprocessUnmatched').optional().isBoolean().toBoolean(),
  body('reprocessUnsent').optional().isBoolean().toBoolean(),
  body('reprocessWindowDays').optional({ nullable: true }).isInt({ min: 1, max: 90 }).toInt(),
];

router.get(
  '/config',
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = ensureTenantId(req);
    const config = await loadMetaOfflineConfig(tenantId);
    res.json({
      success: true,
      data: toPublicMetaOfflineConfig(config),
    });
  })
);

router.put(
  '/config',
  requireTenant,
  configValidators,
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = ensureTenantId(req);
    const bodyPayload = req.body ?? {};

    const config = await upsertMetaOfflineConfig(tenantId, {
      offlineEventSetId: bodyPayload.offlineEventSetId,
      pixelId: bodyPayload.pixelId,
      businessId: bodyPayload.businessId,
      appId: bodyPayload.appId,
      actionSource: bodyPayload.actionSource,
      eventName: bodyPayload.eventName,
      reprocessUnmatched: bodyPayload.reprocessUnmatched,
      reprocessUnsent: bodyPayload.reprocessUnsent,
      reprocessWindowDays: bodyPayload.reprocessWindowDays,
      ...(bodyPayload.accessToken !== undefined ? { accessToken: bodyPayload.accessToken } : {}),
      ...(bodyPayload.appSecret !== undefined ? { appSecret: bodyPayload.appSecret } : {}),
    });

    res.json({
      success: true,
      data: toPublicMetaOfflineConfig(config),
    });
  })
);

export { router as metaOfflineRouter };
