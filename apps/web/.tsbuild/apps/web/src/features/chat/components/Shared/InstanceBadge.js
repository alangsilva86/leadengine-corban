import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { forwardRef, memo, useMemo } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import { cn } from '@/lib/utils.js';
import useInstancePresentation from '../../hooks/useInstancePresentation.js';
const DEFAULT_COLOR = '#94A3B8';
const InstanceChip = memo(forwardRef(function InstanceChip({ label, color, withDot = true, className }, ref) {
    const dotStyle = useMemo(() => ({ backgroundColor: color ?? DEFAULT_COLOR }), [color]);
    const textStyle = useMemo(() => ({ color: color ?? DEFAULT_COLOR }), [color]);
    const backgroundStyle = useMemo(() => {
        const resolved = color ?? DEFAULT_COLOR;
        return {
            backgroundColor: `${resolved}1A`,
            borderColor: `${resolved}33`,
        };
    }, [color]);
    return (_jsxs("span", { ref: ref, className: cn('inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide', className), style: backgroundStyle, children: [withDot ? _jsx("span", { className: "h-1.5 w-1.5 rounded-full", style: dotStyle }) : null, _jsx("span", { style: textStyle, children: label })] }));
}));
export const InstanceBadge = memo(function InstanceBadge({ instanceId, withTooltip = true, withDot = true, fallbackLabel = 'Instância desconhecida', className, }) {
    const presentation = useInstancePresentation(instanceId);
    const label = presentation.label ?? fallbackLabel;
    const tooltip = presentation.phone ?? presentation.number ?? null;
    const chip = (_jsx(InstanceChip, { label: label, color: presentation.color, withDot: withDot, className: className }));
    if (!withTooltip || !tooltip) {
        return chip;
    }
    return (_jsxs(Tooltip, { delayDuration: 120, children: [_jsx(TooltipTrigger, { asChild: true, children: chip }), _jsx(TooltipContent, { className: "text-xs", children: _jsxs("div", { className: "flex flex-col", children: [_jsx("span", { className: "font-semibold", children: label }), _jsx("span", { className: "text-foreground-muted", children: tooltip })] }) })] }));
});
export default InstanceBadge;
