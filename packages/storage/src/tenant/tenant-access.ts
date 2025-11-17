import { DomainError } from '@ticketz/core';

export interface TenantScopedUser {
  id?: string | null;
  tenantId?: string | null;
  role?: string | null;
}

export class TenantAccessError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'FORBIDDEN', details);
    this.name = 'TenantAccessError';
  }
}

export const normalizeTenantId = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const ensureTenantFromUser = (
  user: TenantScopedUser | null | undefined,
  details?: Record<string, unknown>
): string => {
  const tenantId = normalizeTenantId(user?.tenantId);

  if (!tenantId) {
    throw new TenantAccessError('Tenant obrigatório para esta operação.', {
      ...(details ?? {}),
      userId: user?.id ?? null,
    });
  }

  return tenantId;
};

export const assertTenantConsistency = (
  tenantId: string,
  requestedTenantId: unknown,
  details?: Record<string, unknown>
): void => {
  const normalizedRequested = normalizeTenantId(requestedTenantId);

  if (normalizedRequested && normalizedRequested !== tenantId) {
    throw new TenantAccessError('Tentativa de acesso a dados de outro tenant.', {
      ...(details ?? {}),
      tenantId,
      requestedTenantId: normalizedRequested,
    });
  }
};

export const resolveTenantAccess = (
  user: TenantScopedUser | null | undefined,
  requestedTenantId?: unknown,
  details?: Record<string, unknown>
): string => {
  const tenantId = ensureTenantFromUser(user, details);
  assertTenantConsistency(tenantId, requestedTenantId, details);
  return tenantId;
};
