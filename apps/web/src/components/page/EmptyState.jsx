import { cn } from '@/lib/utils.js';

/**
 * Estado vazio padrão: ícone, título, explicação e até duas ações.
 * Use em listas sem itens, buscas sem resultado e telas sem dados.
 *
 * @param {object} props
 * @param {import('react').ElementType} [props.icon] Ícone do lucide-react.
 * @param {import('react').ReactNode} props.title Frase curta: "Nenhum contato ainda".
 * @param {import('react').ReactNode} [props.description] O que fazer a seguir.
 * @param {import('react').ReactNode} [props.action] Ação principal (Button).
 * @param {import('react').ReactNode} [props.secondaryAction] Ação secundária (Button variant="ghost"/link).
 * @param {'default'|'compact'} [props.size]
 * @param {'neutral'|'error'} [props.tone]
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  size = 'default',
  tone = 'neutral',
  className,
  children,
  ...props
}) {
  const compact = size === 'compact';

  return (
    <div
      data-slot="empty-state"
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-2 px-4 py-6' : 'gap-3 px-6 py-12',
        className,
      )}
      {...props}
    >
      {Icon ? (
        <div
          className={cn(
            'flex items-center justify-center rounded-full',
            compact ? 'size-9' : 'size-12',
            tone === 'error'
              ? 'bg-[var(--tone-error-surface)] text-[var(--tone-error-foreground)]'
              : 'bg-muted text-muted-foreground',
          )}
        >
          <Icon className={compact ? 'size-4' : 'size-5'} aria-hidden="true" />
        </div>
      ) : null}
      <div className="max-w-sm space-y-1">
        <p className={cn('font-medium text-foreground', compact ? 'text-sm' : 'text-base')}>{title}</p>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
      {action || secondaryAction ? (
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}

export default EmptyState;
