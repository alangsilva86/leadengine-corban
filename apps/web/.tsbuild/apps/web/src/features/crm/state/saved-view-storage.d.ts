import type { CrmSavedView, CrmSavedViewsState } from './types';
export declare const readSavedViews: () => CrmSavedViewsState;
export declare const writeSavedViews: (state: CrmSavedViewsState) => void;
export declare const upsertSavedView: (views: CrmSavedView[], view: CrmSavedView) => CrmSavedView[];
export declare const removeSavedView: (views: CrmSavedView[], targetId: string) => CrmSavedView[];
