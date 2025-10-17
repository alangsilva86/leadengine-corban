import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  SAVED_VIEWS_LIMIT,
  defaultFilters,
  filterAllocationsWithFilters,
  loadStoredFilters,
  loadStoredViews,
  normalizeFilters,
  persistStoredFilters,
  persistStoredViews,
  pruneStaleViews,
  serializeFilters,
} from '../utils/index.js';

export const useInboxViewState = ({ allocations }) => {
  const initialFiltersRef = useRef(loadStoredFilters());
  const initialViewsRef = useRef(loadStoredViews());

  const [filters, setFiltersState] = useState(initialFiltersRef.current);
  const [savedViews, setSavedViews] = useState(initialViewsRef.current);
  const [activeViewId, setActiveViewId] = useState(() => {
    const serialized = serializeFilters(initialFiltersRef.current);
    const matching = initialViewsRef.current.find(
      (view) => serializeFilters(view.filters) === serialized
    );
    return matching?.id ?? null;
  });

  useEffect(() => {
    setSavedViews((current) => pruneStaleViews(current));
  }, []);

  useEffect(() => {
    persistStoredFilters(filters);
  }, [filters]);

  useEffect(() => {
    persistStoredViews(savedViews);
  }, [savedViews]);

  const replaceFilters = useCallback((nextFilters) => {
    setFiltersState(normalizeFilters(nextFilters));
  }, []);

  const updateFilters = useCallback(
    (partial) => {
      setFiltersState((current) => {
        const next = normalizeFilters({ ...current, ...partial });
        if (activeViewId) {
          const activeView = savedViews.find((view) => view.id === activeViewId);
          if (!activeView || serializeFilters(activeView.filters) !== serializeFilters(next)) {
            setActiveViewId(null);
          }
        }
        return next;
      });
    },
    [activeViewId, savedViews]
  );

  const resetFilters = useCallback(() => {
    setFiltersState({ ...defaultFilters });
    setActiveViewId(null);
  }, []);

  const savedViewsWithCount = useMemo(
    () =>
      savedViews.map((view) => ({
        ...view,
        count: filterAllocationsWithFilters(allocations, view.filters).length,
      })),
    [allocations, savedViews]
  );

  const serializedFilters = useMemo(() => serializeFilters(filters), [filters]);

  const matchingSavedView = useMemo(
    () => savedViews.find((view) => serializeFilters(view.filters) === serializedFilters) ?? null,
    [savedViews, serializedFilters]
  );

  useEffect(() => {
    if (matchingSavedView && matchingSavedView.id !== activeViewId) {
      setActiveViewId(matchingSavedView.id);
    } else if (!matchingSavedView && activeViewId) {
      setActiveViewId(null);
    }
  }, [matchingSavedView, activeViewId]);

  const canSaveView = savedViews.length < SAVED_VIEWS_LIMIT && !matchingSavedView;

  const selectSavedView = useCallback(
    (view) => {
      if (!view) {
        return;
      }
      replaceFilters(view.filters);
      setActiveViewId(view.id);
      setSavedViews((current) =>
        current.map((item) =>
          item.id === view.id ? { ...item, lastUsedAt: Date.now() } : item
        )
      );
    },
    [replaceFilters]
  );

  const deleteSavedView = useCallback((view) => {
    if (!view) {
      return;
    }
    setSavedViews((current) => current.filter((item) => item.id !== view.id));
    setActiveViewId((currentId) => (currentId === view.id ? null : currentId));
  }, []);

  const saveCurrentView = useCallback(
    (name) => {
      const trimmed = typeof name === 'string' ? name.trim() : '';
      if (!trimmed) {
        return null;
      }

      if (!canSaveView) {
        if (matchingSavedView) {
          setActiveViewId(matchingSavedView.id);
        }
        return matchingSavedView;
      }

      const newView = {
        id: `view-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: trimmed.slice(0, 48),
        filters: normalizeFilters(filters),
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
      };

      setSavedViews((current) => {
        const next = [...current, newView];
        if (next.length > SAVED_VIEWS_LIMIT) {
          next.shift();
        }
        return next;
      });
      setActiveViewId(newView.id);

      return newView;
    },
    [canSaveView, matchingSavedView, filters]
  );

  const setFilters = useCallback(
    (nextFilters) => {
      replaceFilters(nextFilters);
      setActiveViewId(null);
    },
    [replaceFilters]
  );

  return {
    filters,
    updateFilters,
    resetFilters,
    setFilters,
    savedViews,
    savedViewsWithCount,
    activeViewId,
    selectSavedView,
    deleteSavedView,
    saveCurrentView,
    canSaveView,
    matchingSavedView,
  };
};

export default useInboxViewState;
