import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
import { Clock, Loader2, QrCode, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { cn } from '@/lib/utils.js';
const SIZE_PRESETS = {
    44: {
        container: 'h-44 w-44',
        image: 'h-36 w-36',
        spinner: 'h-12 w-12',
        icon: 'h-24 w-24',
    },
    64: {
        container: 'h-64 w-64',
        image: 'h-56 w-56',
        spinner: 'h-16 w-16',
        icon: 'h-32 w-32',
    },
};
const resolvePreset = (size) => {
    if (!size)
        return SIZE_PRESETS[44];
    if (typeof size === 'number' && SIZE_PRESETS[size]) {
        return SIZE_PRESETS[size];
    }
    if (typeof size === 'string') {
        const parsed = Number.parseInt(size, 10);
        if (Number.isFinite(parsed) && SIZE_PRESETS[parsed]) {
            return SIZE_PRESETS[parsed];
        }
    }
    return SIZE_PRESETS[44];
};
const QrPreview = ({ src, isGenerating = false, statusMessage = null, onGenerate = null, onOpen = null, generateDisabled = false, openDisabled = false, className, illustrationClassName, size = 44, }) => {
    const preset = useMemo(() => resolvePreset(size), [size]);
    const hasQr = Boolean(src);
    const showStatus = Boolean(statusMessage);
    const showActions = Boolean(onGenerate) || Boolean(onOpen);
    return (_jsxs("div", { className: cn('flex flex-col items-center gap-4', className), children: [_jsx("div", { className: cn('flex items-center justify-center rounded-2xl', preset.container, illustrationClassName), children: hasQr ? (_jsx("img", { src: src ?? undefined, alt: "QR Code do WhatsApp", className: cn('rounded-lg shadow-inner', preset.image) })) : isGenerating ? (_jsx(Loader2, { className: cn('animate-spin', preset.spinner) })) : (_jsx(QrCode, { className: preset.icon })) }), showStatus ? (_jsxs("div", { className: "flex items-center gap-2 text-xs text-muted-foreground", role: "status", "aria-live": "polite", children: [_jsx(Clock, { className: "h-3.5 w-3.5" }), statusMessage] })) : null, showActions ? (_jsxs("div", { className: "flex flex-wrap justify-center gap-2", children: [onGenerate ? (_jsxs(Button, { size: "sm", variant: "ghost", onClick: () => void onGenerate?.(), disabled: generateDisabled, children: [_jsx(RefreshCcw, { className: "mr-2 h-4 w-4" }), " Gerar novo QR"] })) : null, onOpen ? (_jsx(Button, { size: "sm", variant: "outline", onClick: onOpen, disabled: openDisabled, children: "Abrir em tela cheia" })) : null] })) : null] }));
};
export default QrPreview;
