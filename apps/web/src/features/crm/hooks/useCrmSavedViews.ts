import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { normalizeCrmFilters } from '../utils/filter-serialization';
import { readSavedViews, removeSavedView, upsertSavedView, writeSavedViews } from '../state/saved-view-storage';
import type { CrmFilterState, CrmSavedView, CrmSavedViewsState, CrmSavedViewScope } from '../state/types';

const SAVED_VIEWS_QUERY_KEY = ['crm', 'savedViews'] as const;

type SaveViewInput = {
  id?: string;
  name: string;
  description?: string | null;
  scope: CrmSavedViewScope;
  filters: CrmFilterState;
  activate?: boolean;
};

type SelectViewInput = {
  id: string | null;
};

const createId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `crm-view-${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
};

const persistState = (state: CrmSavedViewsState) => {
  writeSavedViews(state);
  return state;
};

export const useCrmSavedViews = () => {
  const queryClient = useQueryClient();

  const savedViewsQuery = useQuery({
    queryKey: SAVED_VIEWS_QUERY_KEY,
    queryFn: () => Promise.resolve(readSavedViews()),
    staleTime: Infinity,
    cacheTime: Infinity,
  });

  const saveMutation = useMutation({
    mutationFn: async (input: SaveViewInput) => {
      const current = readSavedViews();
      const normalizedFilters = normalizeCrmFilters(input.filters);
      const now = new Date().toISOString();
      const targetId = input.id ?? createId();

      const existing = current.views.find((view) => view.id === targetId);
      const view: CrmSavedView = {
        id: targetId,
        name: input.name.trim(),
        description: input.description ?? null,
        scope: input.scope,
        filters: normalizedFilters,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };

      const nextViews = upsertSavedView(current.views, view);
      const nextState = persistState({
        views: nextViews,
        activeViewId: input.activate ? view.id : current.activeViewId,
      });

      return nextState;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(SAVED_VIEWS_QUERY_KEY, data);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (viewId: string) => {
      const current = readSavedViews();
      const nextViews = removeSavedView(current.views, viewId);
      const nextState = persistState({
        views: nextViews,
        activeViewId: current.activeViewId === viewId ? null : current.activeViewId,
      });
      return nextState;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(SAVED_VIEWS_QUERY_KEY, data);
    },
  });

  const selectMutation = useMutation({
    mutationFn: async ({ id }: SelectViewInput) => {
      const current = readSavedViews();
      const activeViewId = id && current.views.some((view) => view.id === id) ? id : null;
      const nextState = activeViewId === current.activeViewId ? current : persistState({
        views: current.views,
        activeViewId,
      });
      return nextState;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(SAVED_VIEWS_QUERY_KEY, data);
    },
  });

  const state = savedViewsQuery.data ?? { views: [], activeViewId: null };
  const activeView = useMemo(() => {
    if (!state.activeViewId) {
      return null;
    }
    return state.views.find((view) => view.id === state.activeViewId) ?? null;
  }, [state.activeViewId, state.views]);

  const createSavedView = (input: { name: string; scope: CrmSavedViewScope; description?: string | null; filters: CrmFilterState }) =>
    saveMutation.mutateAsync({
      name: input.name,
      scope: input.scope,
      description: input.description,
      filters: input.filters,
      activate: true,
    });

  const updateSavedView = (view: CrmSavedView, filters: CrmFilterState) =>
    saveMutation.mutateAsync({
      id: view.id,
      name: view.name,
      description: view.description ?? null,
      scope: view.scope,
      filters,
      activate: true,
    });

  const deleteSavedView = (view: CrmSavedView) => deleteMutation.mutateAsync(view.id);

  const selectSavedView = (id: string | null) => selectMutation.mutateAsync({ id });

  return {
    views: state.views,
    activeViewId: state.activeViewId,
    activeView,
    isLoading: savedViewsQuery.isLoading,
    isSaving: saveMutation.isPending,
    isDeleting: deleteMutation.isPending,
    createSavedView,
    updateSavedView,
    deleteSavedView,
    selectSavedView,
    refetch: savedViewsQuery.refetch,
  };
};

export default useCrmSavedViews;
