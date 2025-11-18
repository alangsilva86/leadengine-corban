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
  describe('resolveTenantId', () => {
    it('returns tenant from authenticated user when no overrides are present', () => {
      const req = buildRequest({ user: { tenantId: 'tenant-123' } });

      expect(resolveTenantId(req)).toBe('tenant-123');
    });

    it('allows explicit tenantId when it matches authenticated tenant', () => {
      const req = buildRequest({ user: { tenantId: 'tenant-123' }, query: { tenantId: 'tenant-123' } });

      expect(resolveTenantId(req)).toBe('tenant-123');
    });

    it('throws when headers attempt to override tenant context', () => {
      const req = buildRequest({ user: { tenantId: 'tenant-123' }, headers: { 'x-tenant-id': 'tenant-999' } });

      expect(() => resolveTenantId(req)).toThrowErrorMatchingInlineSnapshot('"Tentativa de acesso a dados de outro tenant."');
    });
  });

  describe('buildFilters', () => {
    it('applies default status when none is provided', () => {
      const filters = buildFilters({});
      expect(filters).toMatchObject({
        agreementId: undefined,
        instanceId: undefined,
        statuses: ['active'],
        tags: [],
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

      expect(filters).toMatchObject({
        agreementId: 'agr-123',
        instanceId: 'inst-1',
        statuses: ['active', 'ended'],
      });
    });
  });
});
