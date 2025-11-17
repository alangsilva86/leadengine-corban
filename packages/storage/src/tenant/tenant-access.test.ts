import { describe, expect, it } from 'vitest';

import {
  assertTenantConsistency,
  ensureTenantFromUser,
  resolveTenantAccess,
  TenantAccessError,
} from './tenant-access';

describe('tenant-access helpers', () => {
  it('resolves tenant from user when everything matches', () => {
    const tenantId = resolveTenantAccess({ id: 'user-1', tenantId: 'tenant-1' }, 'tenant-1');
    expect(tenantId).toBe('tenant-1');
  });

  it('throws when user has no tenant', () => {
    expect(() => ensureTenantFromUser({ id: 'user-1' })).toThrow(TenantAccessError);
  });

  it('throws when requested tenant does not match user tenant', () => {
    expect(() => resolveTenantAccess({ tenantId: 'tenant-1' }, 'tenant-2')).toThrow(TenantAccessError);
  });

  it('throws when asserting tenant consistency fails', () => {
    expect(() => assertTenantConsistency('tenant-1', 'tenant-2')).toThrow(TenantAccessError);
  });
});
