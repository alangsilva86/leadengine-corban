import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import MessageBubble from './MessageBubble.jsx';
import EventCard from './EventCard.jsx';
const Divider = ({ label }) => (_jsxs("div", { className: "my-4 flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-foreground-muted", children: [_jsx("span", { className: "h-px flex-1 bg-surface-overlay-glass-border" }), _jsx("span", { className: "px-2 text-foreground", children: label }), _jsx("span", { className: "h-px flex-1 bg-surface-overlay-glass-border" })] }));
const resolveAuthorKey = (payload = {}) => {
    const direction = typeof payload.direction === 'string' ? payload.direction.toLowerCase() : 'inbound';
    const authorCandidate = payload.authorId ??
        payload.userId ??
        payload.agentId ??
        payload.contactId ??
        payload.contact?.id ??
        payload.metadata?.whatsapp?.remoteJid ??
        payload.metadata?.remoteJid ??
        payload.metadata?.contactPhone ??
        payload.remoteJid ??
        payload.chatId ??
        payload.contact?.phone ??
        '';
    return `${direction}|${authorCandidate}`;
};
export const MessageTimeline = ({ items, loading, hasMore, onLoadMore, typingAgents = [], showNewMessagesHint = false, onScrollToBottom, }) => (_jsxs("div", { className: "chat-scroll-content relative flex h-full min-h-0 flex-col gap-3", role: "log", "aria-live": "polite", "aria-relevant": "additions", children: [hasMore ? (_jsx("button", { type: "button", onClick: () => onLoadMore?.(), className: "mx-auto mt-2 rounded-full bg-surface-overlay-quiet px-4 py-1 text-xs text-foreground-muted ring-1 ring-surface-overlay-glass-border transition hover:bg-surface-overlay-strong", children: loading ? 'Carregando...' : 'Carregar anteriores' })) : null, items?.map((entry, index) => {
            if (entry.type === 'divider') {
                return _jsx(Divider, { label: entry.label }, entry.id);
            }
            if (entry.type === 'message') {
                const payload = entry.payload;
                const previousEntry = index > 0 ? items[index - 1] : null;
                const nextEntry = index < items.length - 1 ? items[index + 1] : null;
                const previousPayload = previousEntry?.type === 'message' ? previousEntry.payload : null;
                const nextPayload = nextEntry?.type === 'message' ? nextEntry.payload : null;
                const currentKey = resolveAuthorKey(payload);
                const sameAsPrevious = previousPayload ? resolveAuthorKey(previousPayload) === currentKey : false;
                const sameAsNext = nextPayload ? resolveAuthorKey(nextPayload) === currentKey : false;
                const shouldShowMetadata = !sameAsPrevious;
                return (_jsx(MessageBubble, { message: payload, isContinuation: sameAsPrevious, isTail: !sameAsNext, isFirst: !previousPayload, showMetadata: shouldShowMetadata }, entry.id));
            }
            return _jsx(EventCard, { entry: entry }, entry.id);
        }), typingAgents.length > 0 ? (_jsxs("div", { className: "flex items-center gap-2 rounded-full bg-success-soft px-3 py-1 text-xs text-success-strong", children: [_jsx("div", { className: "h-2 w-2 animate-pulse rounded-full bg-success" }), typingAgents[0].userName ?? 'Agente', " digitando\u2026"] })) : null, showNewMessagesHint ? (_jsxs(_Fragment, { children: [_jsxs("div", { role: "separator", "aria-label": "Novas mensagens", className: "my-6 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.35em] text-foreground-muted", children: [_jsx("span", { className: "h-px flex-1 bg-surface-overlay-glass-border/80" }), _jsx("span", { children: "Novas mensagens" }), _jsx("span", { className: "h-px flex-1 bg-surface-overlay-glass-border/80" })] }), _jsxs("button", { type: "button", onClick: () => onScrollToBottom?.(), disabled: !onScrollToBottom, className: "pointer-events-auto absolute bottom-4 right-4 inline-flex items-center gap-1 rounded-full border border-surface-overlay-glass-border bg-surface-overlay-quiet/90 px-3 py-1.5 text-[11px] font-semibold text-foreground shadow-[0_16px_32px_-24px_rgba(15,23,42,0.9)] transition hover:bg-surface-overlay-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-inbox-primary)] disabled:cursor-not-allowed disabled:opacity-60", children: ["Pular para o fim", _jsx("span", { "aria-hidden": "true", children: "\u2193" })] })] })) : null] }));
export default MessageTimeline;
