import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from '@/lib/utils.js';
const TONE_STYLES = {
    info: 'border-[var(--tone-info-border)] bg-[var(--tone-info-surface)] text-[var(--tone-info-foreground)]',
    warning: 'border-warning-soft-border bg-warning-soft text-warning-strong',
    success: 'border-success-soft-border bg-success-soft text-success-strong',
    error: 'border-[var(--tone-error-border)] bg-[var(--tone-error-surface)] text-[var(--tone-error-foreground)]',
    neutral: 'border-[var(--tone-neutral-border)] bg-[var(--tone-neutral-surface)] text-[var(--tone-neutral-foreground)]',
};
export const NoticeBanner = ({ tone, variant, icon = null, children, className }) => {
    const resolvedTone = tone ?? variant ?? 'info';
    const toneClass = TONE_STYLES[resolvedTone] ?? TONE_STYLES.info;
    return (_jsxs("div", { className: cn('flex items-start gap-2 rounded-lg border px-4 py-3 text-sm backdrop-blur-sm', toneClass, className), children: [icon ? _jsx("span", { className: "mt-0.5 text-base", children: icon }) : null, _jsx("div", { className: "space-y-1 text-left leading-relaxed", children: children })] }));
};
export default NoticeBanner;
