import { Check } from 'lucide-react';
import { cn } from '@/lib/utils.js';
import { AI_MODE_OPTIONS, DEFAULT_AI_MODE, isValidAiMode } from './aiModes.js';

const AiModeMenu = ({ mode, onSelect, disabled = false, onRequestClose }) => {
  const normalizedMode = isValidAiMode(mode) ? mode : DEFAULT_AI_MODE;

  return (
    <div className="flex w-60 flex-col gap-1" role="menu" aria-label="Selecionar modo da IA">
      {AI_MODE_OPTIONS.map((option) => {
        const isActive = option.value === normalizedMode;
        return (
          <button
            key={option.value}
            type="button"
            role="menuitemradio"
            aria-checked={isActive}
            className={cn(
              'flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-inbox-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--surface-shell)]',
              isActive
                ? 'bg-[color:color-mix(in_srgb,var(--accent-inbox-primary)_14%,transparent)] text-foreground shadow-[0_2px_8px_-6px_rgba(15,23,42,0.45)]'
                : 'text-foreground hover:bg-surface-overlay-strong'
            )}
            onClick={() => {
              if (disabled) return;
              onSelect?.(option.value);
              onRequestClose?.();
            }}
            disabled={disabled}
          >
            <span
              className={cn(
                'mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-surface-overlay-glass-border text-xs',
                isActive
                  ? 'border-[color:var(--accent-inbox-primary)] bg-[color:var(--accent-inbox-primary)] text-white'
                  : 'text-foreground-muted'
              )}
              aria-hidden
            >
              {isActive ? <Check className="h-3 w-3" /> : null}
            </span>
            <span className="flex-1">
              <span className="block font-medium leading-tight">{option.label}</span>
              {option.description ? (
                <span className="mt-1 block text-xs leading-snug text-foreground-muted">{option.description}</span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
import { Bot, Brain, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.jsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import { cn } from '@/lib/utils.js';
import useAiControlPanel from './hooks/useAiControlPanel.js';

const AiModeMenu = ({
  ticket,
  aiMode,
  aiConfidence,
  onAiModeChange,
  onTakeOver,
  onGiveBackToAi,
  aiModeChangeDisabled = false,
  className,
}) => {
  const {
    aiModeOptions,
    normalizedAiMode,
    aiModeSelectDisabled,
    handleAiModeSelect,
    aiConfidenceLabel,
    aiConfidenceToneClass,
    handleTakeOverClick,
    handleGiveBackClick,
    takeoverDisabled,
    giveBackDisabled,
    takeoverTooltipMessage,
    giveBackTooltipMessage,
  } = useAiControlPanel({
    ticket,
    aiMode,
    aiConfidence,
    onAiModeChange,
    onTakeOver,
    onGiveBackToAi,
    aiModeChangeDisabled,
  });

  const activeMode = aiModeOptions.find((option) => option.value === normalizedAiMode) ?? aiModeOptions[0];
  const triggerLabel = activeMode?.label ?? 'Modo IA';
  const triggerDisabled = aiModeSelectDisabled && takeoverDisabled && giveBackDisabled;

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={`Modo IA: ${triggerLabel}`}
              data-testid="ai-mode-menu-trigger"
              data-state={normalizedAiMode}
              data-disabled={triggerDisabled ? '' : undefined}
              className={cn(
                'inline-flex h-9 shrink-0 items-center gap-2 rounded-full border-surface-overlay-glass-border bg-surface-overlay-quiet px-3 text-xs font-semibold text-foreground shadow-none transition hover:bg-surface-overlay-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-inbox-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--surface-shell)]',
                triggerDisabled && 'cursor-default opacity-60 hover:bg-surface-overlay-quiet',
                className,
              )}
            >
              <Brain className="h-4 w-4" aria-hidden />
              <span className="sr-only">Modo IA</span>
              <span className="max-w-[140px] truncate text-left font-semibold leading-none text-foreground">
                {triggerLabel}
              </span>
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent sideOffset={8}>Modo IA: {triggerLabel}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" sideOffset={8} className="w-64">
        <DropdownMenuLabel>Modo de atuação</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={normalizedAiMode} onValueChange={handleAiModeSelect}>
          {aiModeOptions.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value} disabled={aiModeSelectDisabled}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Confiança da IA</DropdownMenuLabel>
        <div className="px-2 pb-2">
          <span
            className={cn(
              'inline-flex w-full items-center justify-center rounded-full border px-2 py-1 text-xs font-medium',
              aiConfidenceToneClass,
            )}
          >
            {aiConfidenceLabel}
          </span>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(event) => {
            if (takeoverDisabled) {
              event.preventDefault();
              return;
            }
            handleTakeOverClick();
          }}
          disabled={takeoverDisabled}
          title={takeoverTooltipMessage}
          className="gap-2"
        >
          <UserCheck className="h-4 w-4" aria-hidden />
          <span>Assumir</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(event) => {
            if (giveBackDisabled) {
              event.preventDefault();
              return;
            }
            handleGiveBackClick();
          }}
          disabled={giveBackDisabled}
          title={giveBackTooltipMessage}
          className="gap-2"
        >
          <Bot className="h-4 w-4" aria-hidden />
          <span>Devolver à IA</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default AiModeMenu;
