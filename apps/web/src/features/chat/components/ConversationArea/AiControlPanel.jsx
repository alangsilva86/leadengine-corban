import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { cn } from '@/lib/utils.js';
import useAiControlPanel from './hooks/useAiControlPanel.js';

const AiControlPanel = ({
  ticket,
  aiMode,
  aiConfidence,
  onAiModeChange,
  onTakeOver,
  onGiveBackToAi,
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
  });

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <Select value={normalizedAiMode} onValueChange={handleAiModeSelect} disabled={aiModeSelectDisabled}>
        <SelectTrigger
          disabled={aiModeSelectDisabled}
          className={cn(
            'h-9 w-[180px] shrink-0 rounded-full border-surface-overlay-glass-border bg-surface-overlay-quiet text-left text-xs font-medium text-foreground hover:bg-surface-overlay-strong focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-inbox-primary)] focus:ring-offset-1 focus:ring-offset-[color:var(--surface-shell)]',
            aiModeSelectDisabled && 'opacity-60',
          )}
        >
          <SelectValue placeholder="Modo IA" />
        </SelectTrigger>
        <SelectContent className="border-surface-overlay-glass-border bg-surface-overlay-quiet text-foreground">
          {aiModeOptions.map((option) => (
            <SelectItem key={option.value} value={option.value} className="text-sm">
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex h-9 items-center rounded-full border px-3 text-xs font-medium transition-colors',
              aiConfidenceToneClass,
            )}
          >
            {aiConfidenceLabel}
          </span>
        </TooltipTrigger>
        <TooltipContent>Confiança estimada da IA para assumir este ticket.</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 rounded-full border-surface-overlay-glass-border bg-surface-overlay-quiet text-xs font-medium text-foreground hover:bg-surface-overlay-strong"
              onClick={handleTakeOverClick}
              disabled={takeoverDisabled}
            >
              Assumir
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>{takeoverTooltipMessage}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-9 rounded-full bg-[color:var(--accent-inbox-primary)] text-xs font-medium text-white hover:bg-[color:color-mix(in_srgb,var(--accent-inbox-primary)_88%,transparent)] disabled:bg-[color:var(--accent-inbox-primary)]/60"
              onClick={handleGiveBackClick}
              disabled={giveBackDisabled}
            >
              Devolver à IA
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>{giveBackTooltipMessage}</TooltipContent>
      </Tooltip>
    </div>
  );
};

export default AiControlPanel;
