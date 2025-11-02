import type { LucideIcon } from 'lucide-react';
import {
  CalendarClock,
  ClipboardList,
  FileText,
  MessageSquare,
  Paperclip,
  Pencil,
  Phone,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatAiSuggestionNote } from '../utils/aiSuggestions.js';

export type CommandActionId =
  | 'generate-proposal'
  | 'assign-owner'
  | 'register-result'
  | 'ask-ai-help'
  | 'phone-call'
  | 'send-sms'
  | 'quick-followup'
  | 'attach-file'
  | 'edit-contact';

export type CommandActionDialogId = 'register-result' | 'call-result';

type AiSuggestionResult = {
  nextStep: string | null;
  tips: string[];
  objections: string[];
  confidence: number | null;
  raw?: unknown;
};

type AiAssistantContext = {
  requestSuggestions: (payload: { ticket: unknown; timeline: unknown[] }) => Promise<AiSuggestionResult | null>;
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
  onGenerateProposal?: (ticket: unknown) => void;
  onAssign?: (ticket: unknown) => void;
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
  loadingStates?: {
    registerResult?: boolean;
  };
  openDialog?: (dialog: CommandActionDialogId, options?: { returnFocus?: HTMLElement | null }) => void;
  analytics?: (event: { id: CommandActionId; metadata?: Record<string, unknown> }) => void;
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

export type CommandActionDefinition =
  | {
      id: CommandActionId;
      label: string;
      description?: string;
      icon: LucideIcon;
      shortcut?: string;
      shortcutDisplay?: string;
      intent?: 'primary' | 'secondary';
      run: (context: CommandActionRuntimeContext) => void | Promise<void>;
      canExecute?: (context: CommandActionRuntimeContext) => boolean;
      getState?: (context: CommandActionRuntimeContext) => { disabled?: boolean; loading?: boolean };
      analytics?: (context: CommandActionRuntimeContext) => void;
    }
  | {
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
      getState?: (context: CommandActionRuntimeContext) => { disabled?: boolean; loading?: boolean };
      analytics?: (context: CommandActionRuntimeContext) => void;
    };

const isCapabilityEnabled = (value: boolean | undefined) => value !== false;

const buildReturnFocusOption = (returnFocus: HTMLElement | null | undefined) =>
  returnFocus === undefined ? undefined : { returnFocus };

export const DEFAULT_QUICK_ACTIONS: CommandActionDefinition[] = [
  {
    id: 'generate-proposal',
    label: 'Gerar proposta',
    icon: FileText,
    shortcut: 'g',
    shortcutDisplay: '/g',
    intent: 'primary',
    run: ({ ticket, handlers }) => {
      if (!ticket || !handlers?.onGenerateProposal) return;
      handlers.onGenerateProposal(ticket);
    },
    canExecute: ({ ticket, handlers, capabilities }) =>
      Boolean(ticket && handlers?.onGenerateProposal && isCapabilityEnabled(capabilities?.canGenerateProposal)),
  },
  {
    id: 'assign-owner',
    label: 'Atribuir',
    icon: UserPlus,
    shortcut: 'a',
    shortcutDisplay: '/a',
    intent: 'primary',
    run: ({ ticket, handlers }) => {
      if (!ticket || !handlers?.onAssign) return;
      handlers.onAssign(ticket);
    },
    canExecute: ({ ticket, handlers, capabilities }) =>
      Boolean(ticket && handlers?.onAssign && isCapabilityEnabled(capabilities?.canAssign)),
  },
  {
    id: 'register-result',
    label: 'Registrar resultado',
    icon: ClipboardList,
    shortcut: 'r',
    shortcutDisplay: '/r',
    intent: 'primary',
    run: ({ openDialog, returnFocus }) => {
      openDialog?.('register-result', buildReturnFocusOption(returnFocus));
    },
    canExecute: ({ ticket, capabilities }) =>
      Boolean(ticket && isCapabilityEnabled(capabilities?.canRegisterResult)),
    getState: ({ loadingStates }) => ({
      loading: Boolean(loadingStates?.registerResult),
    }),
  },
  {
    id: 'ask-ai-help',
    label: 'Pedir ajuda',
    icon: Sparkles,
    shortcut: 'h',
    shortcutDisplay: '/h',
    run: async (context) => {
      const { ticket, ai, handlers, timeline } = context;

      if (!ticket) {
        toast.error('Selecione um atendimento para pedir ajuda da IA.');
        return;
      }

      if (!ai?.requestSuggestions) {
        toast.error('Assistente de IA indisponível no momento.');
        return;
      }

      if (!handlers?.onCreateNote) {
        toast.error('Não foi possível registrar a nota sugerida pela IA.');
        return;
      }

      try {
        const timelineEntries = Array.isArray(timeline) ? timeline : [];
        const result = await ai.requestSuggestions({ ticket, timeline: timelineEntries });
        if (!result) {
          toast.warning('A IA não retornou recomendações desta vez.');
          return;
        }

        const note = formatAiSuggestionNote(result);
        if (note) {
          handlers.onCreateNote(note);
        } else {
          toast.warning('A IA retornou um resultado sem detalhes utilizáveis.');
        }
      } catch (error) {
        console.error('AI help action failed', error);
        toast.error('Falha ao pedir ajuda da IA', {
          description: error instanceof Error ? error.message : 'Tente novamente em instantes.',
        });
      }
    },
    canExecute: ({ ticket, ai, handlers }) =>
      Boolean(ticket && ai?.requestSuggestions && handlers?.onCreateNote),
    getState: ({ ai }) => ({ loading: Boolean(ai?.isLoading) }),
  },
  {
    id: 'phone-call',
    label: 'Telefonia',
    icon: Phone,
    shortcut: 'c',
    shortcutDisplay: '/c',
    type: 'menu',
    menuItems: [
      {
        id: 'phone-call-dial',
        label: 'Ligar agora',
        run: ({ handlers, phoneNumber }) => {
          if (phoneNumber && handlers?.onCall) {
            handlers.onCall(phoneNumber);
          }
        },
        canExecute: ({ handlers, phoneNumber, capabilities }) =>
          Boolean(phoneNumber && handlers?.onCall && isCapabilityEnabled(capabilities?.canCall)),
      },
      {
        id: 'phone-call-register',
        label: 'Registrar ligação',
        run: ({ openDialog, returnFocus }) =>
          openDialog?.('call-result', buildReturnFocusOption(returnFocus)),
      },
    ],
    canExecute: ({ ticket }) => Boolean(ticket),
  },
  {
    id: 'send-sms',
    label: 'Enviar SMS',
    icon: MessageSquare,
    shortcut: 's',
    shortcutDisplay: '/s',
    run: ({ handlers, phoneNumber }) => {
      if (phoneNumber && handlers?.onSendSMS) {
        handlers.onSendSMS(phoneNumber);
      }
    },
    canExecute: ({ phoneNumber, handlers, capabilities }) =>
      Boolean(phoneNumber && handlers?.onSendSMS && isCapabilityEnabled(capabilities?.canSendSms)),
  },
  {
    id: 'quick-followup',
    label: 'Agendar follow-up',
    icon: CalendarClock,
    shortcut: 't',
    shortcutDisplay: '/t',
    run: ({ ticket, handlers }) => {
      if (!ticket || !handlers?.onScheduleFollowUp) return;
      handlers.onScheduleFollowUp(ticket);
    },
    canExecute: ({ ticket, handlers, capabilities }) =>
      Boolean(ticket && handlers?.onScheduleFollowUp && isCapabilityEnabled(capabilities?.canQuickFollowUp)),
  },
  {
    id: 'attach-file',
    label: 'Anexar arquivo',
    icon: Paperclip,
    run: ({ handlers }) => {
      handlers.onAttachFile?.();
    },
    canExecute: ({ handlers, capabilities }) =>
      Boolean(handlers?.onAttachFile && isCapabilityEnabled(capabilities?.canAttachFile)),
  },
  {
    id: 'edit-contact',
    label: 'Editar contato',
    icon: Pencil,
    run: ({ ticket, handlers }) => {
      if (!handlers?.onEditContact) return;
      handlers.onEditContact(ticket?.contact?.id ?? null);
    },
    canExecute: ({ handlers, capabilities }) =>
      Boolean(handlers?.onEditContact && isCapabilityEnabled(capabilities?.canEditContact)),
  },
];

export const PRIMARY_ACTION_IDS = DEFAULT_QUICK_ACTIONS.filter(
  (action) => action.intent === 'primary',
).map((action) => action.id);

export const ACTIONS_BY_ID = DEFAULT_QUICK_ACTIONS.reduce<Record<CommandActionId, CommandActionDefinition>>(
  (accumulator, action) => {
    accumulator[action.id] = action;
    return accumulator;
  },
  {} as Record<CommandActionId, CommandActionDefinition>,
);

export type { CommandActionDefinition as ChatCommandActionDefinition };
