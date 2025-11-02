import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';
import type { ReactNode } from 'react';
import type { CrmFilterState } from './types';
import { normalizeCrmFilters } from '../utils/filter-serialization';

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

type CrmViewAction =
  | { type: 'SET_FILTERS'; filters: CrmFilterState }
  | { type: 'SET_VIEW'; view: CrmViewType }
  | { type: 'SET_PAGE'; page: number }
  | { type: 'SET_PAGE_SIZE'; pageSize: number }
  | { type: 'SELECT_IDS'; ids: string[] }
  | { type: 'DESELECT_IDS'; ids: string[] }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_LAST_INTERACTED'; id: string | null }
  | { type: 'TOGGLE_REALTIME'; enabled: boolean }
  | { type: 'OPEN_DRAWER'; leadId: string }
  | { type: 'CLOSE_DRAWER' };

const createInitialSelection = (): SelectionState => ({
  selectedIds: new Set(),
  lastInteractedId: null,
});

const INITIAL_STATE = (filters: CrmFilterState): CrmViewContextState => ({
  filters,
  view: 'kanban',
  page: 1,
  pageSize: 30,
  selection: createInitialSelection(),
  isRealtimeEnabled: true,
  activeLeadId: null,
  isDrawerOpen: false,
});

const applySelection = (state: SelectionState, action: CrmViewAction): SelectionState => {
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

const reducer = (state: CrmViewContextState, action: CrmViewAction): CrmViewContextState => {
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

const Context = createContext<CrmViewContextValue | undefined>(undefined);

export const CrmViewProvider = ({ filters, children }: { filters: CrmFilterState; children: ReactNode }) => {
  const normalizedFilters = useMemo(() => normalizeCrmFilters(filters), [filters]);
  const [state, dispatch] = useReducer(reducer, normalizedFilters, INITIAL_STATE);

  const serializedPropFilters = useMemo(() => JSON.stringify(normalizedFilters), [normalizedFilters]);
  const serializedStateFilters = useMemo(() => JSON.stringify(state.filters), [state.filters]);

  useEffect(() => {
    if (serializedPropFilters !== serializedStateFilters) {
      dispatch({ type: 'SET_FILTERS', filters: normalizedFilters });
    }
  }, [serializedPropFilters, serializedStateFilters, normalizedFilters]);

  const setFilters = useCallback((nextFilters: CrmFilterState) => {
    dispatch({ type: 'SET_FILTERS', filters: nextFilters });
  }, []);

  const setView = useCallback((view: CrmViewType) => {
    dispatch({ type: 'SET_VIEW', view });
  }, []);

  const setPage = useCallback((page: number) => {
    dispatch({ type: 'SET_PAGE', page });
  }, []);

  const setPageSize = useCallback((pageSize: number) => {
    dispatch({ type: 'SET_PAGE_SIZE', pageSize });
  }, []);

  const selectIds = useCallback((ids: string[]) => {
    dispatch({ type: 'SELECT_IDS', ids });
  }, []);

  const deselectIds = useCallback((ids: string[]) => {
    dispatch({ type: 'DESELECT_IDS', ids });
  }, []);

  const clearSelection = useCallback(() => {
    dispatch({ type: 'CLEAR_SELECTION' });
  }, []);

  const setLastInteracted = useCallback((id: string | null) => {
    dispatch({ type: 'SET_LAST_INTERACTED', id });
  }, []);

  const toggleRealtime = useCallback((enabled: boolean) => {
    dispatch({ type: 'TOGGLE_REALTIME', enabled });
  }, []);

  const openLeadDrawer = useCallback((leadId: string) => {
    dispatch({ type: 'OPEN_DRAWER', leadId });
  }, []);

  const closeLeadDrawer = useCallback(() => {
    dispatch({ type: 'CLOSE_DRAWER' });
  }, []);

  const value = useMemo<CrmViewContextValue>(
    () => ({
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
    }),
    [
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
    ]
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
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
