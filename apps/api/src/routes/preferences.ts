import { Router, type Request, type Response } from 'express';
import { z, ZodError } from 'zod';

import { asyncHandler } from '../middleware/error-handler';
import { respondWithValidationError } from '../utils/http-validation';
import {
  DEFAULT_INBOX_LIST_POSITION,
  DEFAULT_INBOX_LIST_WIDTH,
  MAX_INBOX_LIST_WIDTH,
  MIN_INBOX_LIST_WIDTH,
  getUserPreferences,
  updateUserPreferences,
} from '../data/user-preferences-store';

const router: Router = Router();

const widthSchema = z
  .preprocess((value) => {
    if (typeof value === 'string' && value.trim().length > 0) {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : value;
    }
    return value;
  }, z.number().min(MIN_INBOX_LIST_WIDTH).max(MAX_INBOX_LIST_WIDTH))
  .optional();

const updatePreferencesSchema = z
  .object({
    inboxListPosition: z.enum(['left', 'right']).optional(),
    inboxListWidth: widthSchema,
  })
  .strict();

const ensureUser = (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Autenticação obrigatória.',
      },
    });
    return null;
  }
  return req.user;
};

router.get(
  '/preferences',
  asyncHandler(async (req: Request, res: Response) => {
    const user = ensureUser(req, res);
    if (!user) {
      return;
    }

    const preferences = getUserPreferences(user.id);
    res.json({
      success: true,
      data: preferences,
    });
  })
);

router.get(
  '/users/:userId/preferences',
  asyncHandler(async (req: Request, res: Response) => {
    const user = ensureUser(req, res);
    if (!user) {
      return;
    }

    const { userId } = req.params;
    if (user.id !== userId && user.role !== 'ADMIN') {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Você não tem permissão para visualizar as preferências desse usuário.',
        },
      });
      return;
    }

    const preferences = getUserPreferences(userId);
    res.json({
      success: true,
      data: preferences,
    });
  })
);

router.patch(
  '/users/:userId/preferences',
  asyncHandler(async (req: Request, res: Response) => {
    const user = ensureUser(req, res);
    if (!user) {
      return;
    }

    const { userId } = req.params;
    if (user.id !== userId && user.role !== 'ADMIN') {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Você não tem permissão para atualizar as preferências desse usuário.',
        },
      });
      return;
    }

    let parsed;
    try {
      parsed = updatePreferencesSchema.parse(req.body ?? {});
    } catch (error) {
      if (error instanceof ZodError) {
        respondWithValidationError(res, error.issues);
        return;
      }
      throw error;
    }

    if (parsed.inboxListPosition === undefined && parsed.inboxListWidth === undefined) {
      const current = getUserPreferences(userId);
      res.json({
        success: true,
        data: current,
        meta: { unchanged: true },
      });
      return;
    }

    const updated = updateUserPreferences(userId, parsed);
    res.json({
      success: true,
      data: updated,
    });
  })
);

router.get(
  '/preferences/defaults',
  (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        inboxListPosition: DEFAULT_INBOX_LIST_POSITION,
        inboxListWidth: DEFAULT_INBOX_LIST_WIDTH,
        minInboxListWidth: MIN_INBOX_LIST_WIDTH,
        maxInboxListWidth: MAX_INBOX_LIST_WIDTH,
      },
    });
  }
);

export { router as preferencesRouter };
