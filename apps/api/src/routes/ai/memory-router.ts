import { Router } from 'express';

import { memoryUpsertMiddlewares } from './memory-controller';

const router: Router = Router();

router.post('/upsert', ...memoryUpsertMiddlewares);

export { router as memoryRouter };
