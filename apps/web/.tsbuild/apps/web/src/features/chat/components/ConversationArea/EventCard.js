import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Clock, FileText, Sparkles, StickyNote, ClipboardList, CircleDollarSign, ScrollText } from 'lucide-react';
import { cn } from '@/lib/utils.js';
import { formatJson } from '@/features/chat/utils/simulation.js';
const TYPE_PRESENTATION = {
    note: { icon: StickyNote, toneClass: 'text-[color:var(--accent-inbox-primary)]' },
    event: { icon: Sparkles, toneClass: 'text-[color:var(--accent-inbox-primary)]' },
    simulation: { icon: ClipboardList, toneClass: 'text-[color:var(--accent-inbox-primary)]' },
    proposal: { icon: FileText, toneClass: 'text-[color:var(--accent-inbox-primary)]' },
    deal: { icon: CircleDollarSign, toneClass: 'text-success-strong' },
};
export const EventCard = ({ entry }) => {
    if (!entry)
        return null;
    const presentation = TYPE_PRESENTATION[entry.type] ?? {
        icon: Clock,
        toneClass: 'text-[color:var(--accent-inbox-primary)]',
    };
    const Icon = presentation.icon ?? Clock;
    const toneClass = presentation.toneClass ?? 'text-[color:var(--accent-inbox-primary)]';
    const payload = entry.payload ?? {};
    const label = payload.label ?? entry.label ?? 'Atualização';
    const description = payload.description ?? payload.body ?? payload.metadata?.description ?? null;
    const timestamp = entry.date ? new Date(entry.date) : null;
    const snapshotJson = formatJson(payload.calculationSnapshot ?? payload.snapshot ?? null);
    const metadataJson = formatJson(payload.metadata ?? null);
    return (_jsxs("div", { className: cn('flex max-w-[70%] flex-col gap-2 rounded-xl border border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-bold)] px-3 py-2 text-xs text-[color:var(--color-inbox-foreground-muted)] shadow-[0_12px_32px_-24px_rgba(15,23,42,0.9)]'), children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2 text-[color:var(--color-inbox-foreground)]", children: [_jsx(Icon, { className: cn('h-4 w-4', toneClass), "aria-hidden": true }), _jsx("span", { className: "font-semibold", children: label })] }), description ? _jsx("p", { className: "text-xs text-[color:var(--color-inbox-foreground)]", children: description }) : null, timestamp ? (_jsx("span", { className: "text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-inbox-foreground-muted)]", children: timestamp.toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) })) : null, snapshotJson || metadataJson ? (_jsxs("details", { className: "group rounded-lg border border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)]/60 px-3 py-2", children: [_jsx("summary", { className: "cursor-pointer list-none text-[11px] font-semibold text-[color:var(--color-inbox-foreground)]", children: _jsxs("span", { className: "inline-flex items-center gap-1", children: [_jsx(ScrollText, { className: "h-3.5 w-3.5 text-[color:var(--accent-inbox-primary)]", "aria-hidden": true }), "Ver detalhes avan\u00E7ados"] }) }), snapshotJson ? (_jsxs("div", { className: "mt-2", children: [_jsx("p", { className: "text-[10px] uppercase tracking-wide text-[color:var(--color-inbox-foreground-muted)]", children: "Snapshot" }), _jsx("pre", { className: "mt-1 max-h-48 overflow-auto rounded-md bg-[color:var(--surface-overlay-inbox-quiet)] px-3 py-2 font-mono text-[11px] leading-relaxed text-[color:var(--color-inbox-foreground-muted)]", children: snapshotJson })] })) : null, metadataJson ? (_jsxs("div", { className: "mt-2", children: [_jsx("p", { className: "text-[10px] uppercase tracking-wide text-[color:var(--color-inbox-foreground-muted)]", children: "Metadata" }), _jsx("pre", { className: "mt-1 max-h-48 overflow-auto rounded-md bg-[color:var(--surface-overlay-inbox-quiet)] px-3 py-2 font-mono text-[11px] leading-relaxed text-[color:var(--color-inbox-foreground-muted)]", children: metadataJson })] })) : null] })) : null] }));
};
export default EventCard;
