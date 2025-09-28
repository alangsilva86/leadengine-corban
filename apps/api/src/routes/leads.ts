import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/error-handler';
import { requireTenant } from '../middleware/auth';

const router: Router = Router();

// GET /api/leads - Listar leads
router.get(
  '/',
  requireTenant,
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      },
    });
  })
);

// POST /api/leads - Criar novo lead
router.post(
  '/',
  requireTenant,
  asyncHandler(async (_req: Request, res: Response) => {
    res.status(201).json({
      success: true,
      data: {
        id: 'mock-lead-id',
        message: 'Lead created successfully',
      },
    });
  })
);

export { router as leadsRouter };
