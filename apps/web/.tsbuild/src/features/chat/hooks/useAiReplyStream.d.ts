export function useAiReplyStream(): {
    start: ({ conversationId, timeline, metadata, mode }: {
        conversationId: any;
        timeline: any;
        metadata?: {} | undefined;
        mode?: string | undefined;
    }) => Promise<void>;
    cancel: () => void;
    reset: () => void;
    status: string;
    message: string;
    toolCalls: never[];
    model: null;
    usage: null;
    error: null;
};
export default useAiReplyStream;
