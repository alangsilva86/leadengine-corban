import { useMemo } from 'react';

type CrmRole = 'agent' | 'manager' | 'admin';

type PermissionSet = {
  canEditLead: boolean;
  canMoveLead: boolean;
  canManageTasks: boolean;
  canManageCampaigns: boolean;
  canManageSavedViews: boolean;
  canViewSensitiveData: boolean;
};

const ROLE_PERMISSIONS: Record<CrmRole, PermissionSet> = {
  agent: {
    canEditLead: true,
    canMoveLead: true,
    canManageTasks: true,
    canManageCampaigns: false,
    canManageSavedViews: true,
    canViewSensitiveData: false,
  },
  manager: {
    canEditLead: true,
    canMoveLead: true,
    canManageTasks: true,
    canManageCampaigns: true,
    canManageSavedViews: true,
    canViewSensitiveData: true,
  },
  admin: {
    canEditLead: true,
    canMoveLead: true,
    canManageTasks: true,
    canManageCampaigns: true,
    canManageSavedViews: true,
    canViewSensitiveData: true,
  },
};

const resolveRole = () => {
  if (typeof window === 'undefined') {
    return 'agent' as CrmRole;
  }
  const stored = window.localStorage.getItem('leadengine:crm:role');
  if (stored === 'manager' || stored === 'admin' || stored === 'agent') {
    return stored;
  }
  return 'agent';
};

export const useCrmPermissions = () => {
  const role = resolveRole();
  return useMemo(() => ({ role, ...ROLE_PERMISSIONS[role] }), [role]);
};

export default useCrmPermissions;
