const isBrowser = () => typeof window !== 'undefined';
export const readPreference = (key, fallback) => {
    if (!isBrowser()) {
        return fallback;
    }
    try {
        const stored = window.localStorage.getItem(key);
        if (stored === null) {
            return fallback;
        }
        return stored === 'true';
    }
    catch (error) {
        console.warn('Failed to read preference', { key, error });
        return fallback;
    }
};
export const writePreference = (key, value) => {
    if (!isBrowser()) {
        return;
    }
    try {
        window.localStorage.setItem(key, value ? 'true' : 'false');
    }
    catch (error) {
        console.warn('Failed to persist preference', { key, error });
    }
};
const scrollMemory = new Map();
export const createScrollMemory = (key) => ({
    read: () => scrollMemory.get(key),
    write: (position) => {
        if (typeof position === 'number' && Number.isFinite(position)) {
            scrollMemory.set(key, position);
        }
    },
    clear: () => {
        scrollMemory.delete(key);
    },
});
export const CONTEXT_PREFERENCE_KEY = 'inbox_context_open';
export const LIST_SCROLL_STORAGE_KEY = 'inbox:queue-list';
export default {
    readPreference,
    writePreference,
    createScrollMemory,
};
