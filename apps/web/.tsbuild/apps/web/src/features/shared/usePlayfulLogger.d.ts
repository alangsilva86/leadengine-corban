export function usePlayfulLogger(prefix?: string): {
    log: (message: any, details: any) => void;
    warn: (message: any, details: any) => void;
    error: (message: any, details: any) => void;
};
export default usePlayfulLogger;
