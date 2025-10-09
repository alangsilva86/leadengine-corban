import { cn } from '@/lib/utils.js';

const TONE_STYLES = {
  info: 'border-[var(--tone-info-border)] bg-[var(--tone-info-surface)] text-[var(--tone-info-foreground)]',
  warning:
    'border-[var(--tone-warning-border)] bg-[var(--tone-warning-surface)] text-[var(--tone-warning-foreground)]',
  success:
    'border-[var(--tone-success-border)] bg-[var(--tone-success-surface)] text-[var(--tone-success-foreground)]',
  error: 'border-[var(--tone-error-border)] bg-[var(--tone-error-surface)] text-[var(--tone-error-foreground)]',
  neutral:
    'border-[var(--tone-neutral-border)] bg-[var(--tone-neutral-surface)] text-[var(--tone-neutral-foreground)]',
};

export const NoticeBanner = ({ tone, variant, icon = null, children, className }) => {
  const resolvedTone = tone ?? variant ?? 'info';
  const toneClass = TONE_STYLES[resolvedTone] ?? TONE_STYLES.info;

  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-lg border px-4 py-3 text-sm backdrop-blur-sm',
        toneClass,
        className
      )}
    >
      {icon ? <span className="mt-0.5 text-base">{icon}</span> : null}
      <div className="space-y-1 text-left leading-relaxed">{children}</div>
    </div>
  );
};

export default NoticeBanner;
