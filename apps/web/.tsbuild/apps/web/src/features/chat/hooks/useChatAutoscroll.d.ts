export function useChatAutoscroll(): {
    scrollRef: import("react").MutableRefObject<HTMLElement | null>;
    scrollToBottom: (options?: {
        behavior?: ScrollBehavior;
        force?: boolean;
    }) => void;
    isNearBottom: boolean;
};
export default useChatAutoscroll;
