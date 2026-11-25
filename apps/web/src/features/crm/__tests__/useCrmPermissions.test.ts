import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const authState: { user: { role?: string } | null } = { user: null };

vi.mock('@/features/auth/AuthProvider.jsx', () => ({
  useAuth: () => authState,
}));

import useCrmPermissions from '../state/permissions';

describe('useCrmPermissions', () => {
  beforeEach(() => {
    authState.user = null;
    window.localStorage.clear();
  });

  it('defaults to agent role when there is no authenticated role', () => {
    const { result } = renderHook(() => useCrmPermissions());
    expect(result.current.role).toBe('agent');
    expect(result.current.canManageCampaigns).toBe(false);
    expect(result.current.canEditLead).toBe(true);
    expect(result.current.canViewSensitiveData).toBe(false);
  });

  it('maps SUPERVISOR to manager and allows sensitive data', () => {
    authState.user = { role: 'SUPERVISOR' };
    const { result } = renderHook(() => useCrmPermissions());
    expect(result.current.role).toBe('manager');
    expect(result.current.canManageCampaigns).toBe(true);
    expect(result.current.canViewSensitiveData).toBe(true);
  });

  it('maps ADMIN to admin', () => {
    authState.user = { role: 'ADMIN' };
    const { result } = renderHook(() => useCrmPermissions());
    expect(result.current.role).toBe('admin');
    expect(result.current.canViewSensitiveData).toBe(true);
  });

  it('ignores roles stored in localStorage (LGPD: permissão vem da sessão)', () => {
    window.localStorage.setItem('leadengine:crm:role', 'manager');
    authState.user = { role: 'AGENT' };
    const { result } = renderHook(() => useCrmPermissions());
    expect(result.current.role).toBe('agent');
    expect(result.current.canViewSensitiveData).toBe(false);
  });
});
