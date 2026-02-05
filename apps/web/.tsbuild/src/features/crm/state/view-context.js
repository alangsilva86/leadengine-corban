import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';
import { normalizeCrmFilters } from '../utils/filter-serialization';
const createInitialSelection = () => ({
    selectedIds: new Set(),
    lastInteractedId: null,
});
const INITIAL_STATE = (filters) => ({
    filters,
    view: 'kanban',
    page: 1,
    pageSize: 30,
    selection: createInitialSelection(),
    isRealtimeEnabled: true,
    activeLeadId: null,
    isDrawerOpen: false,
});
const applySelection = (state, action) => {
    switch (action.type) {
        case 'SELECT_IDS': {
            if (!Array.isArray(action.ids) || action.ids.length === 0) {
                return state;
            }
            const next = new Set(state.selectedIds);
            action.ids.forEach((id) => {
                if (typeof id === 'string' && id) {
                    next.add(id);
                }
            });
            return { selectedIds: next, lastInteractedId: action.ids[action.ids.length - 1] ?? state.lastInteractedId };
        }
        case 'DESELECT_IDS': {
            if (!Array.isArray(action.ids) || action.ids.length === 0) {
                return state;
            }
            const next = new Set(state.selectedIds);
            action.ids.forEach((id) => next.delete(id));
            const lastInteractedId = state.lastInteractedId && next.has(state.lastInteractedId) ? state.lastInteractedId : null;
            return { selectedIds: next, lastInteractedId };
        }
        case 'CLEAR_SELECTION': {
            if (state.selectedIds.size === 0 && state.lastInteractedId === null) {
                return state;
            }
            return createInitialSelection();
        }
        case 'SET_LAST_INTERACTED': {
            return { ...state, lastInteractedId: action.id };
        }
        default:
            return state;
    }
};
const reducer = (state, action) => {
    switch (action.type) {
        case 'SET_FILTERS':
            return { ...state, filters: action.filters, page: 1 };
        case 'SET_VIEW':
            return { ...state, view: action.view };
        case 'SET_PAGE':
            return { ...state, page: Math.max(1, action.page) };
        case 'SET_PAGE_SIZE':
            return { ...state, pageSize: Math.max(1, action.pageSize), page: 1 };
        case 'SELECT_IDS':
        case 'DESELECT_IDS':
        case 'CLEAR_SELECTION':
        case 'SET_LAST_INTERACTED':
            return { ...state, selection: applySelection(state.selection, action) };
        case 'TOGGLE_REALTIME':
            return { ...state, isRealtimeEnabled: action.enabled };
        case 'OPEN_DRAWER':
            return { ...state, activeLeadId: action.leadId, isDrawerOpen: true };
        case 'CLOSE_DRAWER':
            return { ...state, isDrawerOpen: false, activeLeadId: null };
        default:
            return state;
    }
};
const Context = createContext(undefined);
export const CrmViewProvider = ({ filters, children }) => {
    const normalizedFilters = useMemo(() => normalizeCrmFilters(filters), [filters]);
    const [state, dispatch] = useReducer(reducer, normalizedFilters, INITIAL_STATE);
    const serializedPropFilters = useMemo(() => JSON.stringify(normalizedFilters), [normalizedFilters]);
    const serializedStateFilters = useMemo(() => JSON.stringify(state.filters), [state.filters]);
    useEffect(() => {
        if (serializedPropFilters !== serializedStateFilters) {
            dispatch({ type: 'SET_FILTERS', filters: normalizedFilters });
        }
    }, [serializedPropFilters, serializedStateFilters, normalizedFilters]);
    const setFilters = useCallback((nextFilters) => {
        dispatch({ type: 'SET_FILTERS', filters: nextFilters });
    }, []);
    const setView = useCallback((view) => {
        dispatch({ type: 'SET_VIEW', view });
    }, []);
    const setPage = useCallback((page) => {
        dispatch({ type: 'SET_PAGE', page });
    }, []);
    const setPageSize = useCallback((pageSize) => {
        dispatch({ type: 'SET_PAGE_SIZE', pageSize });
    }, []);
    const selectIds = useCallback((ids) => {
        dispatch({ type: 'SELECT_IDS', ids });
    }, []);
    const deselectIds = useCallback((ids) => {
        dispatch({ type: 'DESELECT_IDS', ids });
    }, []);
    const clearSelection = useCallback(() => {
        dispatch({ type: 'CLEAR_SELECTION' });
    }, []);
    const setLastInteracted = useCallback((id) => {
        dispatch({ type: 'SET_LAST_INTERACTED', id });
    }, []);
    const toggleRealtime = useCallback((enabled) => {
        dispatch({ type: 'TOGGLE_REALTIME', enabled });
    }, []);
    const openLeadDrawer = useCallback((leadId) => {
        dispatch({ type: 'OPEN_DRAWER', leadId });
    }, []);
    const closeLeadDrawer = useCallback(() => {
        dispatch({ type: 'CLOSE_DRAWER' });
    }, []);
    const value = useMemo(() => ({
        state,
        setFilters,
        setView,
        setPage,
        setPageSize,
        selectIds,
        deselectIds,
        clearSelection,
        setLastInteracted,
        toggleRealtime,
        openLeadDrawer,
        closeLeadDrawer,
    }), [
        state,
        setFilters,
        setView,
        setPage,
        setPageSize,
        selectIds,
        deselectIds,
        clearSelection,
        setLastInteracted,
        toggleRealtime,
        openLeadDrawer,
        closeLeadDrawer,
    ]);
    return _jsx(Context.Provider, { value: value, children: children });
};
export const useCrmViewContext = () => {
    const context = useContext(Context);
    if (!context) {
        throw new Error('useCrmViewContext deve ser usado dentro de CrmViewProvider');
    }
    return context;
};
export const useCrmViewState = () => useCrmViewContext().state;
export default CrmViewProvider;
