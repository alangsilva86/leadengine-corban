import { Router } from 'express';

import { metaOfflineRouter } from './integrations/meta-offline-router';
import { whatsappInstancesRouter } from './integrations/instances.router';
import { callbacksRouter } from './integrations/callbacks.router';
import { metricsRouter } from './integrations/metrics.router';

const router: Router = Router();

router.use('/meta/offline-conversions', metaOfflineRouter);
router.use('/whatsapp', whatsappInstancesRouter);
router.use('/callbacks', callbacksRouter);
router.use('/metrics', metricsRouter);

export const integrationsRouter = router;
export { __testing as __instancesTesting } from './integrations/instances.router';
