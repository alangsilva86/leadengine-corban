import { Router } from 'express';

import { ticketsBaseRouter } from './tickets.base';
import { ticketNotesRouter } from './tickets.notes';
import { ticketsMessagesRouter } from './tickets.messages';

const router = Router();

router.use('/', ticketsBaseRouter);
router.use('/', ticketNotesRouter);
router.use('/', ticketsMessagesRouter);

export { router as ticketsRouter };
