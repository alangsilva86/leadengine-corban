type CrmRole = 'agent' | 'manager' | 'admin';
export declare const useCrmPermissions: () => {
    canEditLead: boolean;
    canMoveLead: boolean;
    canManageTasks: boolean;
    canManageCampaigns: boolean;
    canManageSavedViews: boolean;
    canViewSensitiveData: boolean;
    role: CrmRole;
};
export default useCrmPermissions;
