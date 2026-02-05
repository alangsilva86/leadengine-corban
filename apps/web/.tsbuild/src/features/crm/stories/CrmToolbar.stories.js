import CrmToolbar from '../components/CrmToolbar';
const sampleFilters = {
    search: 'Empresa XPTO',
    stages: ['qualification'],
    owners: ['owner:me'],
    origins: ['web'],
    channels: ['whatsapp'],
    score: { min: 50, max: 90 },
    inactivityDays: 3,
};
const savedViewsHandlers = {
    views: [
        {
            id: 'view-1',
            name: 'Leads quentes',
            scope: 'personal',
            filters: sampleFilters,
            description: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        },
    ],
    activeViewId: 'view-1',
    isSaving: false,
    isDeleting: false,
    createSavedView: async () => { },
    updateSavedView: async () => { },
    deleteSavedView: async () => { },
    selectSavedView: async () => { },
};
const meta = {
    title: 'CRM/Toolbar',
    component: CrmToolbar,
    args: {
        filters: sampleFilters,
        filterOptions: {
            stages: [
                { id: 'qualification', label: 'Qualificação' },
                { id: 'proposal', label: 'Proposta' },
            ],
            owners: [
                { id: 'owner:me', label: 'Meus leads' },
                { id: 'owner:team', label: 'Equipe' },
            ],
            origins: [
                { id: 'web', label: 'Formulário Web' },
                { id: 'ads', label: 'Campanhas Ads' },
            ],
            channels: [
                { id: 'whatsapp', label: 'WhatsApp' },
                { id: 'email', label: 'E-mail' },
            ],
        },
        onFiltersChange: () => { },
        onClearFilters: () => { },
        selectedCount: 2,
        totalCount: 128,
        savedViews: savedViewsHandlers,
        onRefresh: () => { },
    },
};
export default meta;
export const Default = {};
export const LoadingSavedViews = {
    args: {
        savedViews: {
            ...savedViewsHandlers,
            isSaving: true,
        },
    },
};
export const BulkDisabled = {
    args: {
        selectedCount: 0,
    },
};
