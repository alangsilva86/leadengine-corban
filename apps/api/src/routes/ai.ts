import { Router } from 'express';

import { configRouter } from './ai/config-router';
import { replyRouter } from './ai/reply-router';
import { suggestRouter } from './ai/suggest-router';
import { memoryRouter } from './ai/memory-router';

const router: Router = Router();

router.use('/', configRouter);
router.use('/', replyRouter);
router.use('/', suggestRouter);
router.use('/memory', memoryRouter);

export { router as aiRouter };
