import type { CrmFilterState, CrmSavedView } from '../state/types';
type CrmToolbarFilterOptions = {
    stages: Array<{
        id: string;
        label: string;
    }>;
    owners: Array<{
        id: string;
        label: string;
    }>;
    origins: Array<{
        id: string;
        label: string;
    }>;
    channels: Array<{
        id: string;
        label: string;
    }>;
};
type CrmToolbarSavedViews = {
    views: CrmSavedView[];
    activeViewId: string | null;
    isSaving: boolean;
    isDeleting: boolean;
    createSavedView: (input: {
        name: string;
        scope: CrmSavedView['scope'];
        filters: CrmFilterState;
    }) => Promise<unknown>;
    updateSavedView: (view: CrmSavedView, filters: CrmFilterState) => Promise<unknown>;
    deleteSavedView: (view: CrmSavedView) => Promise<unknown>;
    selectSavedView: (viewId: string | null) => Promise<unknown>;
};
type BulkAction = {
    id: string;
    label: string;
};
type CrmToolbarProps = {
    filters: CrmFilterState;
    onFiltersChange: (next: CrmFilterState) => void;
    onClearFilters?: () => void;
    filterOptions: CrmToolbarFilterOptions;
    totalCount?: number;
    selectedCount?: number;
    onClearSelection?: () => void;
    onBulkAction?: (actionId: string) => void;
    bulkActions?: BulkAction[];
    isBulkProcessing?: boolean;
    onRefresh?: () => void;
    isRefreshing?: boolean;
    onCreateLead?: () => void;
    savedViews: CrmToolbarSavedViews;
};
declare const CrmToolbar: ({ filters, onFiltersChange, onClearFilters, filterOptions, totalCount, selectedCount, onClearSelection, onBulkAction, bulkActions, isBulkProcessing, onRefresh, isRefreshing, onCreateLead, savedViews, }: CrmToolbarProps) => import("react/jsx-runtime").JSX.Element;
export default CrmToolbar;
