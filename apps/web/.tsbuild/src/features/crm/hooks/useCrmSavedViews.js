import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { normalizeCrmFilters } from '../utils/filter-serialization';
import { readSavedViews, removeSavedView, upsertSavedView, writeSavedViews } from '../state/saved-view-storage';
const SAVED_VIEWS_QUERY_KEY = ['crm', 'savedViews'];
const createId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `crm-view-${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
};
const persistState = (state) => {
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
        mutationFn: async (input) => {
            const current = readSavedViews();
            const normalizedFilters = normalizeCrmFilters(input.filters);
            const now = new Date().toISOString();
            const targetId = input.id ?? createId();
            const existing = current.views.find((view) => view.id === targetId);
            const view = {
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
        mutationFn: async (viewId) => {
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
        mutationFn: async ({ id }) => {
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
    const createSavedView = (input) => saveMutation.mutateAsync({
        name: input.name,
        scope: input.scope,
        description: input.description,
        filters: input.filters,
        activate: true,
    });
    const updateSavedView = (view, filters) => saveMutation.mutateAsync({
        id: view.id,
        name: view.name,
        description: view.description ?? null,
        scope: view.scope,
        filters,
        activate: true,
    });
    const deleteSavedView = (view) => deleteMutation.mutateAsync(view.id);
    const selectSavedView = (id) => selectMutation.mutateAsync({ id });
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
