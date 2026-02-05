export function useSLAClock(ticket: any): {
    deadline: Date | null;
    remainingMs: number | null;
    durationMs: any;
    progress: number | null;
    isOverdue: boolean;
};
export default useSLAClock;
