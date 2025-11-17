import { Counter, Registry } from 'prom-client';

import type { UserRole } from '../middleware/auth';

export type UserMutationOperation =
  | 'create_user'
  | 'invite_user'
  | 'update_user'
  | 'deactivate_user';

export type UserMutationResult = 'success' | 'error';

export interface UserMutationLabels {
  tenantId?: string | null;
  actorRole?: UserRole;
  result?: UserMutationResult;
}

export const userMetricsRegistry = new Registry();

const userMutationsCounter = new Counter<
  'operation' | 'tenantId' | 'actorRole' | 'result'
>({
  name: 'user_mutations_total',
  help: 'Total de mutações de usuários agrupadas por operação e resultado.',
  labelNames: ['operation', 'tenantId', 'actorRole', 'result'],
  registers: [userMetricsRegistry],
});

export const recordUserMutation = (
  operation: UserMutationOperation,
  labels: UserMutationLabels = {}
): void => {
  userMutationsCounter.inc({
    operation,
    tenantId: labels.tenantId ?? 'unknown',
    actorRole: labels.actorRole ?? 'unknown',
    result: labels.result ?? 'success',
  });
};

export const resetUserMetrics = (): void => {
  userMetricsRegistry.resetMetrics();
};
