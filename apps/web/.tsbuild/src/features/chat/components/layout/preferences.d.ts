export declare const readPreference: (key: string, fallback: boolean) => boolean;
export declare const writePreference: (key: string, value: boolean) => void;
export declare const createScrollMemory: (key: string) => {
    read: () => number | undefined;
    write: (position: number) => void;
    clear: () => void;
};
export declare const CONTEXT_PREFERENCE_KEY = "inbox_context_open";
export declare const LIST_SCROLL_STORAGE_KEY = "inbox:queue-list";
export type ScrollMemory = ReturnType<typeof createScrollMemory>;
declare const _default: {
    readPreference: (key: string, fallback: boolean) => boolean;
    writePreference: (key: string, value: boolean) => void;
    createScrollMemory: (key: string) => {
        read: () => number | undefined;
        write: (position: number) => void;
        clear: () => void;
    };
};
export default _default;
