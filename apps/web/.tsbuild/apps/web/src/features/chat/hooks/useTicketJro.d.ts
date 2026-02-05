export function useTicketJro(ticket: any): {
    state: string;
    progress: any;
    deadline: Date | null;
    msRemaining: number | null;
    label: string;
    isOverdue: boolean;
    remainingLabel: string | null;
};
export default useTicketJro;
