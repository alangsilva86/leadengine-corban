import type { CrmSavedView, CrmSavedViewsState } from './types';

const STORAGE_KEY = 'leadengine:crm:savedViews';

const ensureWindow = () => typeof window !== 'undefined';

const safeParse = (raw: string | null): CrmSavedViewsState => {
  if (!raw) {
    return { views: [], activeViewId: null };
  }

  try {
    const parsed = JSON.parse(raw);
    const views = Array.isArray(parsed?.views) ? parsed.views : [];
    const activeViewId = typeof parsed?.activeViewId === 'string' ? parsed.activeViewId : null;
    return { views, activeViewId };
  } catch {
    return { views: [], activeViewId: null };
  }
};

export const readSavedViews = (): CrmSavedViewsState => {
  if (!ensureWindow()) {
    return { views: [], activeViewId: null };
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return safeParse(raw);
};

export const writeSavedViews = (state: CrmSavedViewsState) => {
  if (!ensureWindow()) {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const upsertSavedView = (views: CrmSavedView[], view: CrmSavedView): CrmSavedView[] => {
  const index = views.findIndex((entry) => entry.id === view.id);
  if (index >= 0) {
    const next = [...views];
    next[index] = view;
    return next;
  }
  return [...views, view];
};

export const removeSavedView = (views: CrmSavedView[], targetId: string): CrmSavedView[] => {
  return views.filter((view) => view.id !== targetId);
};
