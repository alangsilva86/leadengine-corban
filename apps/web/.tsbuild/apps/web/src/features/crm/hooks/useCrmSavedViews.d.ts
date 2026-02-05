import type { CrmFilterState, CrmSavedView, CrmSavedViewsState, CrmSavedViewScope } from '../state/types';
export declare const useCrmSavedViews: () => {
    views: any;
    activeViewId: any;
    activeView: any;
    isLoading: false;
    isSaving: boolean;
    isDeleting: boolean;
    createSavedView: (input: {
        name: string;
        scope: CrmSavedViewScope;
        description?: string | null;
        filters: CrmFilterState;
    }) => Promise<CrmSavedViewsState>;
    updateSavedView: (view: CrmSavedView, filters: CrmFilterState) => Promise<CrmSavedViewsState>;
    deleteSavedView: (view: CrmSavedView) => Promise<CrmSavedViewsState>;
    selectSavedView: (id: string | null) => Promise<CrmSavedViewsState>;
    refetch: (options?: import("@tanstack/react-query").RefetchOptions) => Promise<import("@tanstack/react-query").QueryObserverResult<unknown, Error>>;
};
export default useCrmSavedViews;
