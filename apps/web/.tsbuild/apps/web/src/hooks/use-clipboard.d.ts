export function useClipboard(): {
    copy: (rawValue: any, { emptyMessage, successMessage, errorMessage, fallbackMessage, onFallback, }?: {
        emptyMessage?: string | undefined;
        successMessage?: string | undefined;
        errorMessage?: string | undefined;
    }) => Promise<boolean>;
};
export default useClipboard;
