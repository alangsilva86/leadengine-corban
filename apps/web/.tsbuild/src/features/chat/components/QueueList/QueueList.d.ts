export default QueueList;
declare function QueueList({ tickets, selectedTicketId, selectedTicketIds, onSelectTicket, onToggleTicketSelection, onClearSelection, loading, onRefresh, typingAgents, metrics, onBulkRegisterLoss, bulkActionPending, bulkActionsDisabled, }: {
    tickets: any;
    selectedTicketId: any;
    selectedTicketIds?: never[] | undefined;
    onSelectTicket: any;
    onToggleTicketSelection: any;
    onClearSelection: any;
    loading: any;
    onRefresh: any;
    typingAgents?: never[] | undefined;
    metrics: any;
    onBulkRegisterLoss: any;
    bulkActionPending?: boolean | undefined;
    bulkActionsDisabled?: boolean | undefined;
}): import("react/jsx-runtime").JSX.Element;
