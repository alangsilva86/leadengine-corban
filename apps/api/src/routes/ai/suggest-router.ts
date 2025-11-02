import { Router } from 'express';

import { suggestMiddlewares } from './suggest-controller';

const router: Router = Router();

router.post('/suggest', ...suggestMiddlewares);

export { router as suggestRouter };
