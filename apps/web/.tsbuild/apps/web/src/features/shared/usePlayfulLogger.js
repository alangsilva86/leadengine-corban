import { useCallback } from 'react';
const DEFAULT_PREFIX = '🎯 LeadEngine HQ';
const buildPayload = (details) => {
    if (details === undefined) {
        return undefined;
    }
    if (details instanceof Error) {
        return {
            name: details.name,
            message: details.message,
            stack: details.stack,
        };
    }
    return details;
};
export const usePlayfulLogger = (prefix = DEFAULT_PREFIX) => {
    const log = useCallback((message, details) => {
        console.info(`${prefix} :: ${message}`, buildPayload(details));
    }, [prefix]);
    const warn = useCallback((message, details) => {
        console.warn(`${prefix} ⚠️ ${message}`, buildPayload(details));
    }, [prefix]);
    const error = useCallback((message, details) => {
        console.error(`${prefix} 💥 ${message}`, buildPayload(details));
    }, [prefix]);
    return { log, warn, error };
};
export default usePlayfulLogger;
