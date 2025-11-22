import type { Request } from 'express';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@ticketz/storage', () => {
  const normalizeTenantId = (value: unknown): string | null => {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  const ensureTenantFromUser = (user: { tenantId?: string | null }) => {
    const tenantId = normalizeTenantId(user?.tenantId);

    if (!tenantId) {
      throw new Error('Tenant obrigatório para esta operação.');
    }

    return tenantId;
  };

  const assertTenantConsistency = (tenantId: string, requested: unknown) => {
    const normalized = normalizeTenantId(requested);

    if (normalized && normalized !== tenantId) {
      throw new Error('Tentativa de acesso a dados de outro tenant.');
    }
  };

  return { normalizeTenantId, ensureTenantFromUser, assertTenantConsistency };
});

import { resolveRequestTenantId } from '../tenant-service';

const buildRequest = (overrides: Partial<Request> = {}): Request =>
  ({
    headers: {},
    query: {},
    user: { id: 'user-1', tenantId: 'tenant-1' },
    ...overrides,
  } as Request);

describe('tenant-service > resolveRequestTenantId', () => {
  it('honors explicit tenant requests when they match the authenticated tenant', () => {
    const req = buildRequest();

    const resolved = resolveRequestTenantId(req, 'tenant-1');

    expect(resolved).toBe('tenant-1');
  });

  it('rejects mismatched explicit tenants', () => {
    const req = buildRequest();

    expect(() => resolveRequestTenantId(req, 'other-tenant')).toThrow(
      /Tentativa de acesso a dados de outro tenant/,
    );
  });
});
