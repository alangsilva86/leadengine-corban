import { cn } from '@/lib/utils.js';

/** Símbolo do Lead Engine: balão de conversa com seta de avanço (conversa → venda). */
export function BrandMark({ className }) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground', className)}
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-[60%]" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path
          d="M4 12a8 8 0 1 1 3.1 6.3L4 19.5l1.2-3.2A7.96 7.96 0 0 1 4 12Z"
          stroke="currentColor"
        />
        <path d="M9.5 12.5 12 10l2.5 2.5M12 10v5" stroke="currentColor" transform="rotate(90 12 12)" />
      </svg>
    </span>
  );
}

export default BrandMark;
