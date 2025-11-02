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
  );
};

export default AiModeMenu;
