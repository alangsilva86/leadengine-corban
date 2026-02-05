import type { CrmFilterState, CrmSavedView, CrmSavedViewScope } from '../state/types';
declare const CrmSavedViewsMenu: ({ views, activeViewId, filters, onSelect, onSave, onUpdate, onDelete, isSaving, isDeleting, }: {
    views: CrmSavedView[];
    activeViewId: string | null;
    filters: CrmFilterState;
    onSelect: (viewId: string | null) => Promise<unknown>;
    onSave: (payload: {
        name: string;
        scope: CrmSavedViewScope;
        filters: CrmFilterState;
    }) => Promise<unknown>;
    onUpdate: (payload: {
        view: CrmSavedView;
        filters: CrmFilterState;
    }) => Promise<unknown>;
    onDelete: (view: CrmSavedView) => Promise<unknown>;
    isSaving: boolean;
    isDeleting: boolean;
}) => import("react/jsx-runtime").JSX.Element;
export default CrmSavedViewsMenu;
