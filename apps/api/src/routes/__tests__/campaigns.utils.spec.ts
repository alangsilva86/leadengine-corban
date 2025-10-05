import type { Request } from 'express';
import { beforeEach, describe, expect, it } from 'vitest';

import { buildFilters, resolveTenantId } from '../campaigns';

type TestRequest = Request & { user?: { tenantId?: string } };

const buildRequest = (
  overrides: Partial<TestRequest> & { query?: unknown; headers?: Record<string, unknown> } = {}
): TestRequest => {
  const headers = overrides.headers ?? {};
  return {
    query: overrides.query ?? {},
    headers,
    header: (name: string) => {
      const value = headers[name];
      if (typeof value === 'string') {
        return value;
      }
      if (Array.isArray(value)) {
        return value[0];
      }
      return undefined;
    },
    ...overrides,
  } as TestRequest;
};

describe('campaigns route utilities', () => {
  beforeEach(() => {
    process.env.AUTH_MVP_TENANT_ID = 'env-tenant';
  });

  describe('resolveTenantId', () => {
    it('prefers tenantId from query parameters', () => {
      const req = buildRequest({ query: { tenantId: 'query-tenant' } });

      expect(resolveTenantId(req)).toBe('query-tenant');
    });

    it('falls back to header and user when query is missing', () => {
      const req = buildRequest({ headers: { 'x-tenant-id': 'header-tenant' } });

      expect(resolveTenantId(req)).toBe('header-tenant');

      const userReq = buildRequest({ user: { tenantId: 'user-tenant' } });

      expect(resolveTenantId(userReq)).toBe('user-tenant');
    });

    it('uses environment fallback when no tenant can be resolved from request', () => {
      const req = buildRequest();

      expect(resolveTenantId(req)).toBe('env-tenant');
    });
  });

  describe('buildFilters', () => {
    it('applies default status when none is provided', () => {
      const filters = buildFilters({});
      expect(filters).toEqual({
        agreementId: undefined,
        instanceId: undefined,
        statuses: ['active'],
      });
    });

    it('normalises statuses from comma-separated string', () => {
      const filters = buildFilters({ status: 'active,paused,invalid' });
      expect(filters.statuses).toEqual(['active', 'paused']);
    });

    it('keeps provided agreement and instance identifiers trimmed', () => {
      const filters = buildFilters({
        agreementId: '   agr-123   ',
        instanceId: [' inst-1 ', ''],
        status: ['active', 'ended'],
      });

      expect(filters).toEqual({
        agreementId: 'agr-123',
        instanceId: 'inst-1',
        statuses: ['active', 'ended'],
      });
    });
  });
});
