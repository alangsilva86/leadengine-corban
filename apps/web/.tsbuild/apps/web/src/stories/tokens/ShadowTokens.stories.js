import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { shadows } from '../../../tailwind.tokens.js';
const ShadowGrid = () => (_jsx("div", { className: "grid w-full max-w-4xl gap-6 sm:grid-cols-2", children: Object.entries(shadows).map(([name, value]) => (_jsxs("div", { className: "rounded-2xl border border-[color:color-mix(in_oklab,var(--color-border)55%,transparent)] bg-[color:color-mix(in_oklab,var(--color-surface-shell)96%,transparent)] p-6", children: [_jsx("div", { className: "flex h-28 items-center justify-center rounded-xl bg-surface-shell text-sm text-muted-foreground", style: { boxShadow: `var(--shadow-${name}, ${value})` }, children: name.toUpperCase() }), _jsxs("div", { className: "mt-4 space-y-2 text-xs text-muted-foreground", children: [_jsxs("div", { className: "font-mono text-[11px] uppercase tracking-wide text-foreground", children: ["shadow-", name] }), _jsx("code", { className: "block break-words text-[11px] leading-relaxed", children: value })] })] }, name))) }));
export default {
    title: 'Tokens/Sombras',
    component: ShadowGrid,
};
export const Exibir = {};
