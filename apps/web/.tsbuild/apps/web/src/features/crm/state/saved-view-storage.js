const STORAGE_KEY = 'leadengine:crm:savedViews';
const ensureWindow = () => typeof window !== 'undefined';
const safeParse = (raw) => {
    if (!raw) {
        return { views: [], activeViewId: null };
    }
    try {
        const parsed = JSON.parse(raw);
        const views = Array.isArray(parsed?.views) ? parsed.views : [];
        const activeViewId = typeof parsed?.activeViewId === 'string' ? parsed.activeViewId : null;
        return { views, activeViewId };
    }
    catch {
        return { views: [], activeViewId: null };
    }
};
export const readSavedViews = () => {
    if (!ensureWindow()) {
        return { views: [], activeViewId: null };
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return safeParse(raw);
};
export const writeSavedViews = (state) => {
    if (!ensureWindow()) {
        return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};
export const upsertSavedView = (views, view) => {
    const index = views.findIndex((entry) => entry.id === view.id);
    if (index >= 0) {
        const next = [...views];
        next[index] = view;
        return next;
    }
    return [...views, view];
};
export const removeSavedView = (views, targetId) => {
    return views.filter((view) => view.id !== targetId);
};
