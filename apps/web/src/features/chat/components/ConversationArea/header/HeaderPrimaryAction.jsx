import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { cn } from '@/lib/utils.js';

/**
 * Uma única ação principal, escolhida pelo estado da conversa
 * (ver `resolveHeaderPrimaryAction`). Sem pulsar, sem cores de alarme.
 */
const HeaderPrimaryAction = ({ action, onExecute, disabled = false, loading = false, className }) => {
  if (!action) {
    return null;
  }
  const Icon = action.icon ?? null;
  const isDisabled = Boolean(disabled || action.disabled || loading);

  return (
    <Button
      type="button"
      size="sm"
      onClick={onExecute}
      disabled={isDisabled}
      className={cn('shrink-0', className)}
      aria-label={action.ariaLabel ?? action.label}
    >
      {loading ? <Loader2 className="animate-spin" aria-hidden /> : Icon ? <Icon aria-hidden /> : null}
      {action.shortLabel ? (
        <>
          <span className="@lg:hidden">{action.shortLabel}</span>
          <span className="hidden @lg:inline">{action.label}</span>
        </>
      ) : (
        <span>{action.label}</span>
      )}
    </Button>
  );
};

/** Compatibilidade: antigo `PrimaryActionButton` (o tom do SLA não muda mais a cor). */
export const PrimaryActionButton = ({ action, onExecute, disabled }) => (
  <HeaderPrimaryAction action={action} onExecute={onExecute} disabled={disabled} />
);

export default HeaderPrimaryAction;
