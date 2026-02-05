import type { ReactNode } from 'react';
import type { CrmFilterState } from './types';
export type CrmViewType = 'kanban' | 'list' | 'calendar' | 'timeline' | 'aging' | 'insights';
type SelectionState = {
    selectedIds: Set<string>;
    lastInteractedId: string | null;
};
type CrmViewContextState = {
    filters: CrmFilterState;
    view: CrmViewType;
    page: number;
    pageSize: number;
    selection: SelectionState;
    isRealtimeEnabled: boolean;
    activeLeadId: string | null;
    isDrawerOpen: boolean;
};
type CrmViewContextValue = {
    state: CrmViewContextState;
    setFilters: (filters: CrmFilterState) => void;
    setView: (view: CrmViewType) => void;
    setPage: (page: number) => void;
    setPageSize: (pageSize: number) => void;
    selectIds: (ids: string[]) => void;
    deselectIds: (ids: string[]) => void;
    clearSelection: () => void;
    setLastInteracted: (id: string | null) => void;
    toggleRealtime: (enabled: boolean) => void;
    openLeadDrawer: (leadId: string) => void;
    closeLeadDrawer: () => void;
};
export declare const CrmViewProvider: ({ filters, children }: {
    filters: CrmFilterState;
    children: ReactNode;
}) => import("react/jsx-runtime").JSX.Element;
export declare const useCrmViewContext: () => CrmViewContextValue;
export declare const useCrmViewState: () => CrmViewContextState;
export default CrmViewProvider;
