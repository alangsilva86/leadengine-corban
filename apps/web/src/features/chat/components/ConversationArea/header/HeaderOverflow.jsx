import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Bot,
  CalendarClock,
  ClipboardList,
  Copy,
  Ellipsis,
  ExternalLink,
  MessageSquare,
  PanelRight,
  Pencil,
  Phone,
  PhoneCall,
  Sparkles,
  UserCheck,
  Wand2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button.jsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.jsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import { cn } from '@/lib/utils.js';
import { ACTIONS_BY_ID, DEFAULT_QUICK_ACTIONS } from '@/features/chat/actions/inventory';
import { getAllAnchorIdsForCommand } from '../../../actions/commandAnchors.js';
import useAiControlPanel from '../hooks/useAiControlPanel.js';

const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/** Atalhos "/" + tecla (ex.: /r registrar resultado) fora de campos de texto. */
const useSlashShortcuts = (context, focusMap) => {
  useEffect(() => {
    let awaitingShortcut = false;

    const handleKeyDown = (event) => {
      if (event.defaultPrevented) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || TYPING_TAGS.has(target.tagName))) {
        return;
      }
      const key = typeof event.key === 'string' ? event.key.toLowerCase() : '';
      if (key === '/') {
        awaitingShortcut = true;
        return;
      }
      if (!awaitingShortcut) return;
      awaitingShortcut = false;

      const definition = DEFAULT_QUICK_ACTIONS.find((action) => action.shortcut && action.shortcut.toLowerCase() === key);
      if (!definition || definition.type === 'menu' || !(definition.canExecute?.(context) ?? true)) {
        return;
      }
      event.preventDefault();
      const element = focusMap.current.get(definition.id) ?? null;
      const contextWithFocus = { ...context, returnFocus: element };
      definition.run(contextWithFocus);
      definition.analytics?.(contextWithFocus);
    };

    const reset = () => {
      awaitingShortcut = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('blur', reset);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('blur', reset);
    };
  }, [context, focusMap]);
};

/** Âncoras invisíveis usadas por atalhos e guias (`actions/commandAnchors.js`). */
const CommandAnchorMarkers = ({ focusMap }) =>
  DEFAULT_QUICK_ACTIONS.flatMap((action) =>
    getAllAnchorIdsForCommand(action.id).map((anchorId) => (
      <span
        key={anchorId}
        id={anchorId}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        data-command-anchor={action.id}
        onFocus={() => {
          const target = focusMap.current.get(action.id);
          target?.focus?.({ preventScroll: true });
        }}
      />
    )),
  );

const canRun = (definition, context) => Boolean(definition && (definition.canExecute?.(context) ?? true));

/**
 * "Mais ações" (⋯): tudo que não é a ação principal mora aqui —
 * Ligar, Registrar ligação, SMS, follow-up, contato, CRM, modo da IA, sugestão da IA.
 */
const HeaderOverflow = ({
  context,
  focusMap,
  ticket,
  contactId,
  shortId,
  primaryActionId = null,
  aiMode,
  aiConfidence,
  aiModeChangeDisabled,
  onAiModeChange,
  onTakeOver,
  onGiveBackToAi,
  onOpenDetails,
}) => {
  const triggerRef = useRef(null);

  useEffect(() => {
    const trigger = triggerRef.current;
    if (!trigger) return undefined;
    const ids = DEFAULT_QUICK_ACTIONS.filter((action) => action.id !== 'assign-owner').map((action) => action.id);
    ids.forEach((id) => {
      if (!focusMap.current.has(id)) focusMap.current.set(id, trigger);
    });
    return () => {
      ids.forEach((id) => {
        if (focusMap.current.get(id) === trigger) focusMap.current.delete(id);
      });
    };
  }, [focusMap]);

  useSlashShortcuts(context, focusMap);

  const ai = useAiControlPanel({
    ticket,
    aiMode,
    aiConfidence,
    onAiModeChange,
    onTakeOver,
    onGiveBackToAi,
    aiModeChangeDisabled,
  });

  const run = useCallback(
    (definition) => {
      if (!definition) return;
      const contextWithFocus = { ...context, returnFocus: triggerRef.current ?? null };
      definition.run(contextWithFocus);
      definition.analytics?.(contextWithFocus);
    },
    [context],
  );

  const phoneAction = ACTIONS_BY_ID['phone-call'];
  const dialItem = phoneAction?.menuItems?.find((item) => item.id === 'phone-call-dial');
  const registerCallItem = phoneAction?.menuItems?.find((item) => item.id === 'phone-call-register');
  const smsAction = ACTIONS_BY_ID['send-sms'];
  const followUpAction = ACTIONS_BY_ID['quick-followup'];
  const editContactAction = ACTIONS_BY_ID['edit-contact'];
  const aiHelpAction = ACTIONS_BY_ID['ask-ai-help'];
  const registerResultAction = ACTIONS_BY_ID['register-result'];
  const aiHelpLoading = Boolean(aiHelpAction?.getState?.(context)?.loading);

  const items = useMemo(
    () => [
      { id: 'dial', label: 'Ligar', icon: Phone, enabled: canRun(dialItem, context), onSelect: () => run(dialItem) },
      {
        id: 'register-call',
        label: 'Registrar ligação',
        icon: PhoneCall,
        enabled: canRun(registerCallItem, context),
        onSelect: () => run(registerCallItem),
      },
      {
        id: 'sms',
        label: 'Enviar SMS',
        icon: MessageSquare,
        shortcut: smsAction?.shortcutDisplay,
        enabled: canRun(smsAction, context),
        onSelect: () => run(smsAction),
      },
      {
        id: 'follow-up',
        label: 'Agendar follow-up',
        icon: CalendarClock,
        shortcut: followUpAction?.shortcutDisplay,
        enabled: canRun(followUpAction, context),
        onSelect: () => run(followUpAction),
      },
    ],
    [context, dialItem, followUpAction, registerCallItem, run, smsAction],
  );

  const handleCopyId = useCallback(async () => {
    const value = ticket?.id ? String(ticket.id) : null;
    if (!value) return;
    try {
      await navigator.clipboard?.writeText?.(value);
      toast.success('ID da conversa copiado.');
    } catch {
      toast.error('Não foi possível copiar o ID.');
    }
  }, [ticket?.id]);

  return (
    <>
      <CommandAnchorMarkers focusMap={focusMap} />
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button ref={triggerRef} type="button" variant="ghost" size="icon-sm" aria-label="Mais ações">
                <Ellipsis aria-hidden />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">Mais ações</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" sideOffset={6} className="w-64">
          {onOpenDetails ? (
            <>
              <DropdownMenuItem className="md:hidden" onSelect={() => onOpenDetails()}>
                <PanelRight aria-hidden />
                Painel do contato
              </DropdownMenuItem>
              <DropdownMenuSeparator className="md:hidden" />
            </>
          ) : null}
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <DropdownMenuItem
                key={item.id}
                disabled={!item.enabled}
                onSelect={(event) => {
                  if (!item.enabled) {
                    event.preventDefault();
                    return;
                  }
                  item.onSelect();
                }}
              >
                <Icon aria-hidden />
                <span className="flex-1">{item.label}</span>
                {item.shortcut ? <DropdownMenuShortcut>{item.shortcut}</DropdownMenuShortcut> : null}
              </DropdownMenuItem>
            );
          })}
          {primaryActionId !== 'register-result' && registerResultAction ? (
            <DropdownMenuItem
              disabled={!canRun(registerResultAction, context)}
              onSelect={() => run(registerResultAction)}
            >
              <ClipboardList aria-hidden />
              <span className="flex-1">Registrar resultado</span>
              {registerResultAction.shortcutDisplay ? (
                <DropdownMenuShortcut>{registerResultAction.shortcutDisplay}</DropdownMenuShortcut>
              ) : null}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={!canRun(editContactAction, context)}
            onSelect={() => run(editContactAction)}
          >
            <Pencil aria-hidden />
            Editar contato
          </DropdownMenuItem>
          {contactId ? (
            <DropdownMenuItem asChild>
              <a href={`/crm/opportunities?contactId=${encodeURIComponent(contactId)}`}>
                <ExternalLink aria-hidden />
                Abrir no CRM
              </a>
            </DropdownMenuItem>
          ) : null}
          {ticket?.id ? (
            <DropdownMenuItem onSelect={handleCopyId}>
              <Copy aria-hidden />
              <span className="flex-1">Copiar ID da conversa</span>
              {shortId ? <DropdownMenuShortcut className="tracking-normal">#{shortId}</DropdownMenuShortcut> : null}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger
              data-testid="ai-mode-menu-trigger"
              data-state-mode={ai.normalizedAiMode}
              className="gap-2 [&>svg:first-child]:size-4 [&>svg:first-child]:text-muted-foreground"
            >
              <Wand2 aria-hidden />
              <span className="flex-1">Modo da IA</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-64">
              <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Quem responde esta conversa</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={ai.normalizedAiMode} onValueChange={ai.handleAiModeSelect}>
                {ai.aiModeOptions.map((option) => (
                  <DropdownMenuRadioItem key={option.value} value={option.value} disabled={ai.aiModeSelectDisabled}>
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5">
                <span
                  className={cn(
                    'inline-flex w-full items-center justify-center rounded-full border px-2 py-0.5 text-xs font-medium',
                    ai.aiConfidenceToneClass,
                  )}
                >
                  {ai.aiConfidenceLabel}
                </span>
              </div>
              <DropdownMenuItem
                disabled={ai.takeoverDisabled}
                title={ai.takeoverTooltipMessage}
                onSelect={(event) => {
                  if (ai.takeoverDisabled) {
                    event.preventDefault();
                    return;
                  }
                  ai.handleTakeOverClick();
                }}
              >
                <UserCheck aria-hidden />
                Assumir
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={ai.giveBackDisabled}
                title={ai.giveBackTooltipMessage}
                onSelect={(event) => {
                  if (ai.giveBackDisabled) {
                    event.preventDefault();
                    return;
                  }
                  ai.handleGiveBackClick();
                }}
              >
                <Bot aria-hidden />
                Devolver à IA
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem
            disabled={!canRun(aiHelpAction, context) || aiHelpLoading}
            onSelect={() => run(aiHelpAction)}
          >
            <Sparkles aria-hidden />
            <span className="flex-1">{aiHelpLoading ? 'Pedindo sugestão…' : 'Sugestão da IA'}</span>
            {aiHelpAction?.shortcutDisplay ? <DropdownMenuShortcut>{aiHelpAction.shortcutDisplay}</DropdownMenuShortcut> : null}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};

export default HeaderOverflow;
