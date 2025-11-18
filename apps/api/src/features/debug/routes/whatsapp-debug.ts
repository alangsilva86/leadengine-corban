import { Router, type Request, type Response } from 'express';

import { asyncHandler } from '../../../middleware/error-handler';
import { normalizeQueryValue } from '../../../utils/request-parsers';
import {
  listWhatsappDebugMessages,
  processWhatsappDebugReplay,
  processWhatsappDebugSend,
  processWhatsappDebugStream,
  resolveWhatsappDebugContext,
} from '../services/whatsapp-debug';

const router: Router = Router();

router.get(
  '/messages',
  asyncHandler(async (req: Request, res: Response) => {
    const { tenantId } = resolveWhatsappDebugContext(req.headers);

    const rawLimit = normalizeQueryValue(req.query.limit);
    const limitCandidate = rawLimit ? Number(rawLimit) : NaN;
    let limit = Number.isFinite(limitCandidate) && limitCandidate > 0 ? Math.floor(limitCandidate) : 50;
    limit = Math.min(Math.max(limit, 1), 200);

    const normalizedDirection = normalizeQueryValue(req.query.direction);
    const direction =
      normalizedDirection && normalizedDirection.toLowerCase() === 'outbound'
        ? 'OUTBOUND'
        : normalizedDirection && normalizedDirection.toLowerCase() === 'inbound'
          ? 'INBOUND'
          : null;

    const chatId = normalizeQueryValue(req.query.chatId) ?? null;

    const data = await listWhatsappDebugMessages({ tenantId, limit, chatId, direction });

    res.json({
      success: true,
      data,
    });
  })
);

router.post(
  '/send',
  asyncHandler(async (req: Request, res: Response) => {
    const { tenantId } = resolveWhatsappDebugContext(req.headers);
    const data = await processWhatsappDebugSend({ tenantId, payload: req.body });

    res.json({
      success: true,
      data,
    });
  })
);

router.post(
  '/stream',
  asyncHandler(async (req: Request, res: Response) => {
    const { tenantId } = resolveWhatsappDebugContext(req.headers);
    const data = await processWhatsappDebugStream({ tenantId, payload: req.body });

    res.json({
      success: true,
      data,
    });
  })
);

router.post(
  '/replay',
  asyncHandler(async (req: Request, res: Response) => {
    const { tenantId } = resolveWhatsappDebugContext(req.headers);
    const data = await processWhatsappDebugReplay({ tenantId, payload: req.body });

    res.json({
      success: true,
      data,
    });
  })
);

export { router as whatsappDebugRouter };
