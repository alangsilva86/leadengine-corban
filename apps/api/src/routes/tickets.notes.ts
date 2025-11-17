import { Router, Request, Response } from 'express';
import { body, param } from 'express-validator';

import { asyncHandler } from '../middleware/error-handler';
import { requireTenant } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { addTicketNote, type CreateTicketNoteInput } from '../services/ticket-service';
import { resolveRequestTenantId } from '../services/tenant-service';
import { ensureTicketId, validateTicketId } from './tickets.shared';

const router: Router = Router();

const createNoteValidation = [
  param('id').custom(validateTicketId),
  body('body').isString().isLength({ min: 1, max: 4000 }),
  body('visibility').optional().isIn(['private', 'team', 'public']),
  body('tags').optional().isArray(),
  body('metadata').optional().isObject(),
];

router.post(
  '/:id/notes',
  createNoteValidation,
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const ticketId = ensureTicketId(req.params.id);
    const payload: CreateTicketNoteInput = {
      body: req.body.body,
      visibility: req.body.visibility,
      tags: Array.isArray(req.body.tags) ? req.body.tags.map(String) : undefined,
      metadata: req.body.metadata,
    };

    const note = await addTicketNote(
      resolveRequestTenantId(req),
      ticketId,
      {
        id: req.user!.id,
        name: req.user!.name,
      },
      payload
    );

    res.status(201).json({
      success: true,
      message: 'Nota adicionada ao ticket',
      data: note,
    });
  })
);

export { router as ticketNotesRouter };
