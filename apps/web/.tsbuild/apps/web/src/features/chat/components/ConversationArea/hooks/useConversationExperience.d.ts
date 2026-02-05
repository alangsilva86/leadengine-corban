export function useConversationExperience({ ticket, conversation, messagesQuery, typingIndicator, onSendMessage, onCreateNote, onSendTemplate, onCreateNextStep, onRegisterResult, onRegisterCallResult, onAssign, onGenerateProposal, onScheduleFollowUp, onSendSMS, onEditContact, onContactFieldSave, onDealFieldSave, nextStepValue, onNextStepSave, isRegisteringResult, currentUser, isSending, sendError, composerDisabled, composerDisabledReason, aiMode, aiConfidence, aiModeChangeDisabled, onAiModeChange, onTakeOver, onGiveBackToAi, composerNotice: composerNoticeProp, }: {
    ticket: any;
    conversation: any;
    messagesQuery: any;
    typingIndicator: any;
    onSendMessage: any;
    onCreateNote: any;
    onSendTemplate: any;
    onCreateNextStep: any;
    onRegisterResult: any;
    onRegisterCallResult: any;
    onAssign: any;
    onGenerateProposal: any;
    onScheduleFollowUp: any;
    onSendSMS: any;
    onEditContact: any;
    onContactFieldSave?: (() => Promise<void>) | undefined;
    onDealFieldSave?: (() => Promise<void>) | undefined;
    nextStepValue?: string | undefined;
    onNextStepSave?: (() => Promise<void>) | undefined;
    isRegisteringResult?: boolean | undefined;
    currentUser?: null | undefined;
    isSending?: boolean | undefined;
    sendError?: null | undefined;
    composerDisabled?: boolean | undefined;
    composerDisabledReason?: null | undefined;
    aiMode: any;
    aiConfidence: any;
    aiModeChangeDisabled?: boolean | undefined;
    onAiModeChange: any;
    onTakeOver: any;
    onGiveBackToAi: any;
    composerNotice?: null | undefined;
}): {
    timeline: {
        items: any;
        hasMore: boolean;
        isLoadingMore: boolean;
        onLoadMore: () => void;
        typingAgents: any;
        scrollRef: import("react").MutableRefObject<HTMLElement | null>;
        showNewMessagesHint: boolean;
        onScrollToBottom: () => void;
    };
    composer: {
        ref: import("react").RefObject<null>;
        apiRef: import("react").RefObject<null>;
        notice: any;
        disabled: boolean;
        onSend: (payload: any) => void;
        onTemplate: (template: any) => void;
        onCreateNote: (note: any) => void;
        onTyping: () => void;
        aiState: {
            suggestion: {
                nextStep: string | null;
                tips: any;
                objections: (string | null)[];
                confidence: number | null;
                raw: {};
            } | null;
            confidence: number | null;
            isLoading: boolean;
            error: Error | null;
        };
        isSending: boolean;
        sendError: null;
        aiMode: string;
        aiModeChangeDisabled: boolean;
        onAiModeChange: any;
        aiStreaming: {
            status: string;
            error: null;
            toolCalls: never[];
            onGenerate: () => void;
            onCancel: () => void;
            reset: () => void;
        };
        instanceSelector: {
            options: {
                id: string;
                label: string;
                description: string;
                status: string;
                statusLabel: any;
                statusTone: any;
                connected: boolean;
                isDefault: boolean;
            }[];
            selectedId: string | null;
            selectedLabel: string | null;
            selectedStatus: string | null;
            selectedStatusLabel: any;
            selectedTone: any;
            selectedConnected: boolean;
            defaultId: string | null;
            defaultLabel: string | null;
            loading: boolean;
            disabled: boolean;
            onSelect: (instanceId: any) => void;
            onRefresh: () => Promise<any>;
            notice: {
                type: string;
                message: string;
            } | null;
            isOverride: boolean;
            requireConnected: boolean;
            hasInstances: boolean;
        };
    };
    header: {
        props: {
            ticket: any;
            conversation: any;
            onRegisterResult: any;
            onRegisterCallResult: any;
            onAssign: any;
            onSendTemplate: any;
            onCreateNextStep: any;
            onGenerateProposal: any;
            onScheduleFollowUp: any;
            onSendSMS: any;
            onAttachFile: () => void;
            onEditContact: any;
            isRegisteringResult: boolean;
            onContactFieldSave: () => Promise<void>;
            onDealFieldSave: () => Promise<void>;
            nextStepValue: string;
            onNextStepSave: () => Promise<void>;
            onFocusComposer: () => void;
            currentUser: null;
            slaClock: {
                deadline: Date | null;
                remainingMs: number | null;
                durationMs: any;
                progress: number | null;
                isOverdue: boolean;
            };
            typingAgents: any;
            composerHeight: number;
            onCreateNote: any;
            timeline: any;
            aiAssistant: {
                requestSuggestions: (payload?: {}) => Promise<{
                    nextStep: string | null;
                    tips: any;
                    objections: (string | null)[];
                    confidence: number | null;
                    raw: {};
                }>;
                isLoading: boolean;
                data: {
                    nextStep: string | null;
                    tips: any;
                    objections: (string | null)[];
                    confidence: number | null;
                    raw: {};
                } | null;
                error: Error | null;
                reset: () => void;
                replyStream: {
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
                mode: string;
                queueId: any;
            };
            aiMode: string;
            aiConfidence: number | null;
            aiModeChangeDisabled: boolean;
            onAiModeChange: any;
            onTakeOver: any;
            onGiveBackToAi: any;
        };
    };
};
export default useConversationExperience;
