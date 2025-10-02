import { cn } from '@/lib/utils.js';

const VARIANT_STYLES = {
  info: 'border-sky-500/40 bg-sky-500/10 text-sky-100',
  warning: 'border-amber-500/40 bg-amber-500/15 text-amber-100',
  success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100',
  danger: 'border-destructive/60 bg-destructive/10 text-destructive',
};

export const NoticeBanner = ({ variant = 'info', icon = null, children, className }) => {
  const variantClass = VARIANT_STYLES[variant] ?? VARIANT_STYLES.info;

  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-lg border px-4 py-3 text-sm backdrop-blur-sm',
        variantClass,
        className
      )}
    >
      {icon ? <span className="mt-0.5 text-base">{icon}</span> : null}
      <div className="space-y-1 text-left leading-relaxed">{children}</div>
    </div>
  );
};

export default NoticeBanner;
