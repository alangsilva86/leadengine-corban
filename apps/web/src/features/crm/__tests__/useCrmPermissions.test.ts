import { beforeEach, describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import useCrmPermissions from '../state/permissions.ts';

describe('useCrmPermissions', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('defaults to agent role when no preference stored', () => {
    const { result } = renderHook(() => useCrmPermissions());
    expect(result.current.role).toBe('agent');
    expect(result.current.canManageCampaigns).toBe(false);
    expect(result.current.canEditLead).toBe(true);
  });

  it('reads role from localStorage when available', () => {
    window.localStorage.setItem('leadengine:crm:role', 'manager');
    const { result } = renderHook(() => useCrmPermissions());
    expect(result.current.role).toBe('manager');
    expect(result.current.canManageCampaigns).toBe(true);
    expect(result.current.canViewSensitiveData).toBe(true);
  });

  it('falls back to agent for unknown roles', () => {
    window.localStorage.setItem('leadengine:crm:role', 'unknown');
    const { result } = renderHook(() => useCrmPermissions());
    expect(result.current.role).toBe('agent');
  });
});
