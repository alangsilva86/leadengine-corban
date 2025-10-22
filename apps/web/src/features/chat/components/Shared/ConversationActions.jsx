import { useCallback } from 'react';
import { Button } from '@/components/ui/button.jsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.jsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import { cn } from '@/lib/utils.js';
import {
  CalendarClock,
  ChevronDown,
  ClipboardList,
  Phone,
} from 'lucide-react';
import UserPlus from 'lucide-react/dist/esm/icons/user-plus.js';

export const CONVERSATION_ACTION_IDS = {
  assign: 'conversation-action-assign',
  scheduleFollowUp: 'conversation-action-schedule-follow-up',
  registerResult: 'conversation-action-register-result',
  phone: 'conversation-action-phone',
};

export const DEFAULT_QUICK_ACTION_LINKS = [
  {
    id: CONVERSATION_ACTION_IDS.assign,
    label: 'Atribuir',
    icon: UserPlus,
    canExecute: ({ canAssign } = {}) => canAssign !== false,
  },
  {
    id: CONVERSATION_ACTION_IDS.scheduleFollowUp,
    label: 'Agendar follow-up',
    icon: CalendarClock,
    canExecute: ({ canScheduleFollowUp } = {}) => canScheduleFollowUp !== false,
  },
  {
    id: CONVERSATION_ACTION_IDS.registerResult,
    label: 'Registrar resultado',
    icon: ClipboardList,
    canExecute: ({ canRegisterResult } = {}) => canRegisterResult !== false,
  },
  {
    id: CONVERSATION_ACTION_IDS.phone,
    label: 'Ações de telefone',
    icon: Phone,
    canExecute: ({ hasPhone } = {}) => hasPhone !== false,
  },
];

export const buildQuickActionLinks = (context = {}) =>
  DEFAULT_QUICK_ACTION_LINKS.filter((action) =>
    typeof action.canExecute === 'function' ? action.canExecute(context) : true,
  ).map(({ canExecute, ...rest }) => rest);

export const DEFAULT_RESULT_OPTIONS = [
  { value: 'won', label: 'Ganho' },
  { value: 'lost', label: 'Perda' },
  { value: 'no_contact', label: 'Sem contato' },
  { value: 'disqualified', label: 'Desqualificado' },
];

export const DEFAULT_PHONE_ACTIONS = [
  { value: 'call', label: 'Ligar' },
  { value: 'sms', label: 'Enviar SMS' },
  { value: 'whatsapp', label: 'Abrir WhatsApp' },
  { value: 'copy', label: 'Copiar' },
];

const getShortcutProps = (shortcut) => {
  if (!shortcut) return {};
  return {
    'aria-keyshortcuts': shortcut,
    accessKey: shortcut,
  };
};

const buttonBaseExpanded =
  'rounded-lg border border-surface-overlay-glass-border bg-surface-overlay-quiet text-xs font-medium text-foreground-muted hover:bg-surface-overlay-strong';

const ConversationActions = ({
  layout = 'compact',
  className,
  gap = 'gap-2',
  onAssign,
  onScheduleFollowUp,
  onRegisterResult,
  onPhoneAction,
  resultOptions = DEFAULT_RESULT_OPTIONS,
  resultSelection,
  isRegisteringResult = false,
  phoneActions = DEFAULT_PHONE_ACTIONS,
  assignLabel = 'Atribuir',
  followUpLabel = 'Agendar follow-up',
  registerResultLabel = 'Registrar resultado',
  phoneTriggerLabel = 'Ações de telefone',
  phoneTooltip = 'Ações de telefone',
  assignShortcut,
  followUpShortcut,
  anchorIds = CONVERSATION_ACTION_IDS,
  showPhoneActions = true,
}) => {
  const handleResultSelect = useCallback(
    (value) => {
      if (!value || !onRegisterResult) return;
      onRegisterResult(value);
    },
    [onRegisterResult]
  );

  const handlePhoneSelect = useCallback(
    (action) => {
      if (!action || !onPhoneAction) return;
      onPhoneAction(action);
    },
    [onPhoneAction]
  );

  const hasAssign = typeof onAssign === 'function';
  const hasFollowUp = typeof onScheduleFollowUp === 'function';
  const hasRegisterResult = typeof onRegisterResult === 'function' && resultOptions?.length > 0;
  const hasPhoneActions = showPhoneActions && typeof onPhoneAction === 'function' && phoneActions?.length > 0;

  if (!hasAssign && !hasFollowUp && !hasRegisterResult && !hasPhoneActions) {
    return null;
  }

  const containerClasses = cn('flex flex-wrap items-center', gap, className);

  if (layout === 'expanded') {
    return (
      <div className={containerClasses}>
        {hasAssign ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            id={anchorIds?.assign}
            className={cn(buttonBaseExpanded, 'px-3')}
            onClick={onAssign}
            {...getShortcutProps(assignShortcut)}
          >
            {assignLabel}
          </Button>
        ) : null}

        {hasFollowUp ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            id={anchorIds?.scheduleFollowUp}
            className={cn(buttonBaseExpanded, 'px-3')}
            onClick={onScheduleFollowUp}
            {...getShortcutProps(followUpShortcut)}
          >
            {followUpLabel}
          </Button>
        ) : null}

        {hasRegisterResult ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="sm"
                id={anchorIds?.registerResult}
                className={cn(
                  buttonBaseExpanded,
                  'bg-surface-overlay-quiet px-3 text-foreground hover:bg-surface-overlay-strong focus-visible:ring-surface-overlay-glass-border'
                )}
                disabled={isRegisteringResult}
              >
                <span className="mr-1">{registerResultLabel}</span>
                <ChevronDown className="size-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuRadioGroup value={resultSelection || undefined} onValueChange={handleResultSelect}>
                {resultOptions.map((item) => (
                  <DropdownMenuRadioItem key={item.value} value={item.value} className="min-h-[40px]" disabled={isRegisteringResult}>
                    {item.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}

        {hasPhoneActions ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                id={anchorIds?.phone}
                className={cn(buttonBaseExpanded, 'px-3')}
              >
                <Phone className="mr-2 size-4" aria-hidden />
                {phoneTriggerLabel}
                <ChevronDown className="ml-1 size-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              {phoneActions.map((item) => (
                <DropdownMenuItem key={item.value} className="min-h-[44px]" onSelect={() => handlePhoneSelect(item.value)}>
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    );
  }

  return (
    <div className={containerClasses}>
      {hasAssign ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              id={anchorIds?.assign}
              className="size-9 rounded-lg border border-surface-overlay-glass-border bg-surface-overlay-quiet text-foreground-muted hover:bg-surface-overlay-strong"
              onClick={onAssign}
              {...getShortcutProps(assignShortcut)}
            >
              <UserPlus className="size-4" aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{assignLabel}</TooltipContent>
        </Tooltip>
      ) : null}

      {hasFollowUp ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              id={anchorIds?.scheduleFollowUp}
              className="size-9 rounded-lg border border-surface-overlay-glass-border bg-surface-overlay-quiet text-foreground-muted hover:bg-surface-overlay-strong"
              onClick={onScheduleFollowUp}
              {...getShortcutProps(followUpShortcut)}
            >
              <CalendarClock className="size-4" aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{followUpLabel}</TooltipContent>
        </Tooltip>
      ) : null}

      {hasRegisterResult ? (
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  id={anchorIds?.registerResult}
                  className="size-9 rounded-lg border border-surface-overlay-glass-border bg-surface-overlay-quiet text-foreground-muted hover:bg-surface-overlay-strong"
                  disabled={isRegisteringResult}
                >
                  <ClipboardList className="size-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">{registerResultLabel}</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuRadioGroup value={resultSelection || undefined} onValueChange={handleResultSelect}>
              {resultOptions.map((item) => (
                <DropdownMenuRadioItem key={item.value} value={item.value} className="min-h-[44px]" disabled={isRegisteringResult}>
                  {item.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      {hasPhoneActions ? (
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  id={anchorIds?.phone}
                  className="size-9 rounded-lg border border-surface-overlay-glass-border bg-surface-overlay-quiet text-foreground-muted hover:bg-surface-overlay-strong"
                >
                  <Phone className="size-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">{phoneTooltip}</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="w-52">
            {phoneActions.map((item) => (
              <DropdownMenuItem key={item.value} className="min-h-[44px]" onSelect={() => handlePhoneSelect(item.value)}>
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
};

export default ConversationActions;
