export const MIN_INBOX_LIST_WIDTH: 320;
export const MAX_INBOX_LIST_WIDTH: 560;
export const DEFAULT_INBOX_LIST_WIDTH: 384;
export const DEFAULT_INBOX_LAYOUT_PREFERENCES: Readonly<{
    inboxListWidth: 384;
}>;
export const INBOX_LAYOUT_PREFERENCES_QUERY_KEY: string[];
export function useInboxLayoutPreferences({ enabled }?: {
    enabled?: boolean | undefined;
}): import("@tanstack/react-query").UseQueryResult<{
    inboxListWidth: 384;
    updatedAt?: never;
} | {
    inboxListWidth: number;
    updatedAt: any;
}, Error>;
export default useInboxLayoutPreferences;
