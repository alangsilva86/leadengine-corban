export function useTicketMessages(messagesQuery: any): {
    timelineItems: {
        type: string;
        id: any;
        date: Date | undefined;
        payload: any;
    }[];
    hasMore: boolean;
    isLoadingMore: boolean;
    handleLoadMore: () => void;
    lastEntryKey: any;
};
export default useTicketMessages;
