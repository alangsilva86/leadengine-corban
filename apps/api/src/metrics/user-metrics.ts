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

export interface UserMutationContext {
  roleChanged?: boolean;
  statusChanged?: boolean;
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

type UserMetricLabel = 'tenantId' | 'actorRole' | 'result';

const buildMetricLabels = (labels: UserMutationLabels): Record<UserMetricLabel, string> => ({
  tenantId: labels.tenantId ?? 'unknown',
  actorRole: labels.actorRole ?? 'unknown',
  result: labels.result ?? 'success',
});

const userInviteCreatedCounter = new Counter<UserMetricLabel>({
  name: 'user_invite_created_total',
  help: 'Total de convites criados para usuários internos por tenant e role do ator.',
  labelNames: ['tenantId', 'actorRole', 'result'],
  registers: [userMetricsRegistry],
});

const userRoleUpdatedCounter = new Counter<UserMetricLabel>({
  name: 'user_role_updated_total',
  help: 'Total de alterações de role realizadas para usuários internos.',
  labelNames: ['tenantId', 'actorRole', 'result'],
  registers: [userMetricsRegistry],
});

const userStatusToggledCounter = new Counter<UserMetricLabel>({
  name: 'user_status_toggled_total',
  help: 'Total de ativações/desativações de contas internas.',
  labelNames: ['tenantId', 'actorRole', 'result'],
  registers: [userMetricsRegistry],
});

export const recordUserMutation = (
  operation: UserMutationOperation,
  labels: UserMutationLabels = {},
  context: UserMutationContext = {}
): void => {
  const metricLabels = buildMetricLabels(labels);

  userMutationsCounter.inc({
    operation,
    ...metricLabels,
  });

  if (operation === 'invite_user') {
    userInviteCreatedCounter.inc(metricLabels);
  }

  if (operation === 'update_user' && context.roleChanged) {
    userRoleUpdatedCounter.inc(metricLabels);
  }

  if (operation === 'update_user' && context.statusChanged) {
    userStatusToggledCounter.inc(metricLabels);
  }

  if (operation === 'deactivate_user') {
    userStatusToggledCounter.inc(metricLabels);
  }
};

export const resetUserMetrics = (): void => {
  userMetricsRegistry.resetMetrics();
};
