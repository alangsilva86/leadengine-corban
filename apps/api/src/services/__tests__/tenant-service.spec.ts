import type { Request } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

import {
  registerTenantResolutionHook,
  resetTenantResolutionHooks,
  resolveRequestTenantId,
} from '../tenant-service';

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
  describe('tenantless requests (no silent demo-tenant fallback)', () => {
    const originalMvpTenant = process.env.AUTH_MVP_TENANT_ID;

    afterEach(() => {
      resetTenantResolutionHooks();
      if (originalMvpTenant === undefined) {
        delete process.env.AUTH_MVP_TENANT_ID;
      } else {
        process.env.AUTH_MVP_TENANT_ID = originalMvpTenant;
      }
    });

    it('rejects requests without an authenticated tenant instead of resolving demo-tenant', () => {
      const req = buildRequest({ user: undefined });

      expect(() => resolveRequestTenantId(req)).toThrow(/Tenant obrigatório/);
    });

    it('ignores AUTH_MVP_TENANT_ID and tenant headers for tenantless requests', () => {
      process.env.AUTH_MVP_TENANT_ID = 'demo-tenant';
      const req = buildRequest({ user: undefined, headers: { 'x-tenant-id': 'demo-tenant' } });

      expect(() => resolveRequestTenantId(req, 'demo-tenant')).toThrow(/Tenant obrigatório/);
    });

    it('still honors hooks registered explicitly', () => {
      const unregister = registerTenantResolutionHook(() => 'tenant-from-hook');
      const req = buildRequest({ user: undefined });

      expect(resolveRequestTenantId(req)).toBe('tenant-from-hook');
      unregister();
      expect(() => resolveRequestTenantId(req)).toThrow(/Tenant obrigatório/);
    });
  });
});
