import { useMemo } from 'react';
import { useAuth } from '@/features/auth/AuthProvider.jsx';

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

export const useCrmPermissions = () => {
  const { user } = useAuth();
  const role: CrmRole = user?.role === 'ADMIN' ? 'admin' : user?.role === 'SUPERVISOR' ? 'manager' : 'agent';
  return useMemo(() => ({ role, ...ROLE_PERMISSIONS[role] }), [role]);
};

export default useCrmPermissions;
