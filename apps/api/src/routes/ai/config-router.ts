import { Router, type Request, type Response } from 'express';
import { body, query } from 'express-validator';

import { asyncHandler } from '../middleware/error-handler';
import { requireTenant } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import type { UpsertAiConfigInput, AiAssistantMode } from '@ticketz/storage';

import {
  getModeConfig,
  updateModeConfig,
  getConfigSettings,
  updateConfigSettings,
} from './config-controller';
import { readQueueParam, ensureTenantId } from './utils';

const router: Router = Router();

const modeValidators = [
  body('mode')
    .isIn(['IA_AUTO', 'COPILOTO', 'HUMANO'])
    .withMessage('Modo inválido: use IA_AUTO, COPILOTO ou HUMANO.'),
  body('queueId').optional({ nullable: true }).isString().trim(),
];

router.get(
  '/mode',
  requireTenant,
  query('queueId').optional().isString(),
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = ensureTenantId(req);
    const queueId = readQueueParam(req);
    const data = await getModeConfig(tenantId, queueId);

    res.json({
      success: true,
      data,
    });
  })
);

router.post(
  '/mode',
  requireTenant,
  modeValidators,
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = ensureTenantId(req);
    const queueId = readQueueParam(req);
    const { mode } = req.body as { mode: AiAssistantMode };

    const data = await updateModeConfig(tenantId, queueId, mode);

    res.json({
      success: true,
      data,
    });
  })
);

const configValidators = [
  body('model').isString().trim().notEmpty(),
  body('temperature').optional().isFloat({ min: 0, max: 2 }).toFloat(),
  body('maxOutputTokens').optional({ nullable: true }).isInt({ min: 1 }).toInt(),
  body('systemPromptReply').optional({ nullable: true }).isString(),
  body('systemPromptSuggest').optional({ nullable: true }).isString(),
  body('structuredOutputSchema').optional({ nullable: true }).custom((value) => {
    if (value === null || typeof value === 'object') {
      return true;
    }
    throw new Error('structuredOutputSchema must be an object');
  }),
  body('tools').optional({ nullable: true }).isArray(),
  body('vectorStoreEnabled').optional().isBoolean().toBoolean(),
  body('vectorStoreIds').optional().isArray(),
  body('streamingEnabled').optional().isBoolean().toBoolean(),
  body('defaultMode')
    .optional({ nullable: true })
    .isIn(['IA_AUTO', 'COPILOTO', 'HUMANO'])
    .bail(),
  body('confidenceThreshold').optional({ nullable: true }).isFloat({ min: 0, max: 1 }).toFloat(),
  body('fallbackPolicy').optional({ nullable: true }).isString(),
  body('queueId').optional({ nullable: true }).isString().trim(),
];

router.get(
  '/config',
  requireTenant,
  query('queueId').optional().isString(),
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = ensureTenantId(req);
    const queueId = readQueueParam(req);
    const data = await getConfigSettings(tenantId, queueId);

    res.json({
      success: true,
      data,
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
    const queueId = readQueueParam(req);
    const payload = req.body as UpsertAiConfigInput;

    const data = await updateConfigSettings(tenantId, queueId, payload);

    res.json({
      success: true,
      data,
    });
  })
);

export { router as configRouter };
