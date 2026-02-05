import type { LucideIcon } from 'lucide-react';
export type CommandActionId = 'assign-owner' | 'register-result' | 'ask-ai-help' | 'phone-call' | 'send-sms' | 'quick-followup' | 'attach-file' | 'edit-contact';
export type CommandActionDialogId = 'register-result' | 'call-result';
type AiSuggestionResult = {
    nextStep: string | null;
    tips: string[];
    objections: string[];
    confidence: number | null;
    raw?: unknown;
};
type AiAssistantContext = {
    requestSuggestions: (payload: {
        ticket: unknown;
        timeline: unknown[];
    }) => Promise<AiSuggestionResult | null>;
    isLoading?: boolean;
    data?: AiSuggestionResult | null;
    error?: unknown;
    reset?: () => void;
};
export type ChatActionCapabilities = {
    canGenerateProposal?: boolean;
    canAssign?: boolean;
    canRegisterResult?: boolean;
    canCall?: boolean;
    canSendSms?: boolean;
    canQuickFollowUp?: boolean;
    canAttachFile?: boolean;
    canEditContact?: boolean;
};
export type CommandActionHandlers = {
    onOpenSimulation?: (ticket: unknown) => void;
    onAssign?: (ticket: unknown, userId?: string | null) => void;
    onRegisterResult?: (payload: unknown) => void | Promise<void>;
    onRegisterCallResult?: (payload: unknown) => void | Promise<void>;
    onScheduleFollowUp?: (ticket: unknown) => void;
    onAttachFile?: () => void;
    onEditContact?: (contactId: string | number | undefined | null) => void;
    onCall?: (phoneNumber: string) => void;
    onSendSMS?: (phoneNumber: string) => void;
    onCreateNote?: (body: string) => void;
};
export type CommandActionRuntimeContext = {
    ticket: any | null;
    handlers: CommandActionHandlers;
    capabilities?: ChatActionCapabilities;
    phoneNumber?: string | null;
    timeline?: unknown[];
    ai?: AiAssistantContext;
    targetUserId?: string | null;
    loadingStates?: {
        registerResult?: boolean;
    };
    openDialog?: (dialog: CommandActionDialogId, options?: {
        returnFocus?: HTMLElement | null;
    }) => void;
    analytics?: (event: {
        id: CommandActionId;
        metadata?: Record<string, unknown>;
    }) => void;
    returnFocus?: HTMLElement | null;
};
export type CommandMenuItem = {
    id: string;
    label: string;
    icon?: LucideIcon;
    run: (context: CommandActionRuntimeContext) => void | Promise<void>;
    canExecute?: (context: CommandActionRuntimeContext) => boolean;
    analytics?: (context: CommandActionRuntimeContext) => void;
};
export type CommandActionDefinition = {
    id: CommandActionId;
    label: string;
    description?: string;
    icon: LucideIcon;
    shortcut?: string;
    shortcutDisplay?: string;
    intent?: 'primary' | 'secondary';
    run: (context: CommandActionRuntimeContext) => void | Promise<void>;
    canExecute?: (context: CommandActionRuntimeContext) => boolean;
    getState?: (context: CommandActionRuntimeContext) => {
        disabled?: boolean;
        loading?: boolean;
    };
    analytics?: (context: CommandActionRuntimeContext) => void;
} | {
    id: CommandActionId;
    label: string;
    description?: string;
    icon: LucideIcon;
    shortcut?: string;
    shortcutDisplay?: string;
    intent?: 'primary' | 'secondary';
    type: 'menu';
    menuItems: CommandMenuItem[];
    canExecute?: (context: CommandActionRuntimeContext) => boolean;
    getState?: (context: CommandActionRuntimeContext) => {
        disabled?: boolean;
        loading?: boolean;
    };
    analytics?: (context: CommandActionRuntimeContext) => void;
};
export declare const DEFAULT_QUICK_ACTIONS: CommandActionDefinition[];
export declare const PRIMARY_ACTION_IDS: CommandActionId[];
export declare const ACTIONS_BY_ID: Record<CommandActionId, CommandActionDefinition>;
export type { CommandActionDefinition as ChatCommandActionDefinition };
