import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef } from 'react';
import { MessageSquare, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet.jsx';
import { cn } from '@/lib/utils.js';
import ContextDrawer from './ContextDrawer.jsx';
import SplitLayout from './SplitLayout.jsx';
import useInboxLayoutState from './hooks/useInboxLayoutState.js';
import { createScrollMemory, LIST_SCROLL_STORAGE_KEY } from './preferences.ts';
const listScrollMemory = createScrollMemory(LIST_SCROLL_STORAGE_KEY);
const ListPanelHeader = ({ showCloseButton = false, onToggleListVisibility, toggleLabel = 'Ocultar lista' }) => (_jsxs("div", { className: "sticky top-0 z-10 flex shrink-0 items-center justify-between gap-3 border-b border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-bold)] px-4 py-3 text-sm font-semibold text-[color:var(--color-inbox-foreground)]", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "flex h-8 w-8 items-center justify-center rounded-2xl bg-[color:color-mix(in_srgb,var(--accent-inbox-primary)_18%,transparent)] text-[color:var(--accent-inbox-primary)] shadow-[var(--shadow-sm)]", children: _jsx(MessageSquare, { className: "h-4 w-4" }) }), _jsxs("div", { className: "space-y-0.5", children: [_jsx("p", { className: "text-sm font-semibold leading-none", children: "Inbox" }), _jsx("p", { className: "text-xs text-[color:var(--color-inbox-foreground-muted)]", children: "Atendimento em tempo real" })] })] }), showCloseButton ? (_jsx(SheetClose, { asChild: true, children: _jsx(Button, { variant: "ghost", size: "icon", className: "h-8 w-8 rounded-full text-[color:var(--color-inbox-foreground-muted)] hover:text-[color:var(--color-inbox-foreground)]", "aria-label": "Fechar lista de tickets", children: _jsx(PanelLeftClose, { className: "h-4 w-4" }) }) })) : null, !showCloseButton && onToggleListVisibility ? (_jsxs(Button, { type: "button", variant: "ghost", size: "sm", className: "inline-flex items-center gap-2 rounded-2xl border border-[color:var(--color-inbox-border)] bg-[color:color-mix(in_srgb,var(--surface-overlay-inbox-quiet)_30%,transparent)] px-3 text-xs font-semibold text-[color:var(--color-inbox-foreground-muted)] transition hover:bg-[color:color-mix(in_srgb,var(--surface-overlay-inbox-quiet)_60%,transparent)] hover:text-[color:var(--color-inbox-foreground)] focus-visible:ring-2 focus-visible:ring-[color:var(--accent-inbox-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--surface-shell)]", onClick: onToggleListVisibility, children: [_jsx(PanelLeftClose, { className: "h-4 w-4", "aria-hidden": true }), toggleLabel] })) : null] }));
const ListPanelContent = ({ children, toolbar }) => (_jsxs("div", { className: "flex min-h-0 min-w-0 flex-col gap-3", children: [toolbar ? _jsx("div", { className: "px-1", children: toolbar }) : null, children] }));
const ListPanelFooter = ({ canPersistPreferences }) => (_jsxs("div", { className: "shrink-0 border-t border-[color:var(--color-inbox-border)] px-4 py-3 text-[11px] text-[color:var(--color-inbox-foreground-muted)]", children: [_jsx("p", { className: "font-medium", children: "\u2325 L alterna lista" }), _jsx("p", { className: "mt-1 uppercase tracking-wide", children: canPersistPreferences ? 'Preferência salva automaticamente' : 'Preferência local temporária' })] }));
const ListPanel = ({ sidebar, canPersistPreferences, showCloseButton = false, onToggleListVisibility, toggleLabel, toolbar = null, }) => {
    const viewportRef = useRef(null);
    useEffect(() => {
        const element = viewportRef.current;
        if (!element)
            return undefined;
        const restore = () => {
            const saved = listScrollMemory.read();
            if (typeof saved === 'number') {
                requestAnimationFrame(() => {
                    element.scrollTop = saved;
                });
            }
        };
        restore();
        const handleScroll = () => {
            listScrollMemory.write(element.scrollTop);
        };
        element.addEventListener('scroll', handleScroll, { passive: true });
        return () => {
            listScrollMemory.write(element.scrollTop);
            element.removeEventListener('scroll', handleScroll);
        };
    }, []);
    return (_jsxs("div", { className: "flex h-full min-h-0 min-w-0 flex-col", "data-pane": "sidebar", children: [_jsx(ListPanelHeader, { showCloseButton: showCloseButton, onToggleListVisibility: onToggleListVisibility, toggleLabel: toggleLabel }), _jsx("div", { ref: viewportRef, id: "listViewport", className: "chat-scroll-area min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable_both-edges] [overflow-clip-margin:24px]", style: { overscrollBehavior: 'contain' }, children: _jsx("div", { className: "px-4 py-4", children: _jsx(ListPanelContent, { toolbar: toolbar, children: sidebar }) }) }), _jsx(ListPanelFooter, { canPersistPreferences: canPersistPreferences })] }));
};
const DesktopToolbar = ({ onToggleListVisibility, onToggleContext, contextOpen, desktopListVisible, headerListButtonLabel, showContextToggle = true, showListToggle = true, }) => (_jsxs("div", { className: "flex items-center gap-2", children: [showListToggle ? (_jsxs(Button, { variant: "outline", size: "sm", className: "hidden border-[color:var(--border-shell)] bg-surface-shell-subtle text-[color:var(--text-shell-muted)] hover:bg-surface-shell xl:inline-flex", onClick: onToggleListVisibility, children: [desktopListVisible ? _jsx(PanelLeftClose, { className: "h-4 w-4" }) : _jsx(PanelLeftOpen, { className: "h-4 w-4" }), _jsx("span", { className: "ml-2 hidden text-xs font-medium xl:inline", children: headerListButtonLabel })] })) : null, showContextToggle ? (_jsxs(Button, { variant: "outline", size: "sm", className: "border-[color:var(--border-shell)] bg-surface-shell-subtle text-[color:var(--text-shell-muted)] hover:bg-surface-shell", onClick: onToggleContext, children: [contextOpen ? _jsx(PanelRightClose, { className: "h-4 w-4" }) : _jsx(PanelRightOpen, { className: "h-4 w-4" }), _jsx("span", { className: "ml-2 hidden text-xs font-medium sm:inline", children: contextOpen ? 'Ocultar painel' : 'Exibir painel' })] })) : null] }));
const DetailSurface = ({ children, context, contextOpen, onContextOpenChange }) => {
    const detailGap = contextOpen ? 'lg:gap-6' : 'lg:gap-0';
    return (_jsxs("div", { className: cn('flex h-full min-h-0 w-full flex-col items-stretch lg:flex-row', detailGap), children: [_jsx("div", { className: "flex h-full min-h-0 min-w-0 flex-1", children: _jsx("section", { className: "flex h-full min-h-0 min-w-0 flex-1 flex-col rounded-3xl border border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] shadow-[var(--shadow-lg)]", children: _jsx("div", { className: "flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden [overflow-clip-margin:24px]", children: children }) }) }), _jsx(ContextDrawer, { open: contextOpen, onOpenChange: onContextOpenChange, desktopContentClassName: "px-4 py-5", children: context })] }));
};
const InboxAppShell = ({ sidebar, children, context, defaultContextOpen = false, title = 'Inbox de Leads', currentUser, toolbar, }) => {
    const isContextAvailable = Boolean(context);
    const { canPersistPreferences, contextDrawerOpen, setContextOpen, desktopListVisible, mobileListOpen, setMobileListOpen, headerListButtonLabel, handleToggleListVisibility, handleToggleContext, shouldRenderSplitLayout, isDesktop, } = useInboxLayoutState({
        defaultContextOpen,
        contextAvailable: isContextAvailable,
        currentUser,
    });
    const listContent = useMemo(() => (_jsx(ListPanel, { sidebar: sidebar, canPersistPreferences: canPersistPreferences, onToggleListVisibility: handleToggleListVisibility, toggleLabel: headerListButtonLabel, toolbar: toolbar })), [sidebar, canPersistPreferences, handleToggleListVisibility, headerListButtonLabel, toolbar]);
    const mobileListContent = useMemo(() => (_jsx(ListPanel, { sidebar: sidebar, canPersistPreferences: canPersistPreferences, showCloseButton: true, toolbar: toolbar })), [sidebar, canPersistPreferences, toolbar]);
    const detailSurface = (_jsx(DetailSurface, { context: context, contextOpen: contextDrawerOpen, onContextOpenChange: setContextOpen, children: children }));
    return (_jsxs("div", { className: "flex h-full min-h-0 flex-1 flex-col bg-surface-shell text-foreground", children: [_jsx("div", { className: "flex h-full min-h-0 flex-1 flex-col overflow-y-auto", children: _jsx("div", { className: "flex min-h-0 flex-1", children: _jsxs("div", { className: "relative flex h-full w-full flex-1 min-h-0 overflow-x-hidden px-2 py-4 sm:px-3 sm:py-5 lg:px-4", children: [_jsx("div", { className: "pointer-events-none absolute left-4 top-4 z-20 lg:hidden", children: _jsx(Button, { variant: "ghost", size: "icon", className: "pointer-events-auto h-10 w-10 rounded-full bg-surface-shell/90 text-[color:var(--text-shell-muted)] shadow-[var(--shadow-md)] hover:text-foreground", onClick: () => setMobileListOpen(true), "aria-label": "Abrir lista de tickets", children: _jsx(PanelLeftOpen, { className: "h-5 w-5" }) }) }), shouldRenderSplitLayout ? (_jsx(SplitLayout, { className: "h-full min-h-0 w-full gap-3 sm:gap-4 lg:gap-6", list: listContent, detail: detailSurface, listClassName: cn('flex min-h-0 min-w-0 flex-col rounded-3xl border border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] shadow-[var(--shadow-lg)] w-[360px] min-w-[340px] max-w-[380px] flex-shrink-0'), detailClassName: "flex min-h-0 min-w-0 flex-col", listWidth: 360, isListVisible: Boolean(sidebar) && (isDesktop ? desktopListVisible : true), minListWidth: 340, maxListWidthPx: 380, maxListWidthToken: "380px", resizable: false })) : (_jsx("div", { className: "flex h-full w-full", children: detailSurface })), isDesktop && sidebar && !desktopListVisible ? (_jsx("div", { className: "pointer-events-none absolute left-6 top-4 z-20 hidden lg:block", children: _jsxs(Button, { type: "button", size: "sm", variant: "outline", className: "pointer-events-auto inline-flex items-center gap-2 rounded-full border-[color:var(--border-shell)] bg-[color:var(--surface-shell)]/90 px-3 text-xs font-semibold text-[color:var(--text-shell-muted)] shadow-[var(--shadow-sm)] hover:bg-surface-shell-subtle hover:text-foreground", onClick: handleToggleListVisibility, children: [_jsx(PanelLeftOpen, { className: "h-4 w-4", "aria-hidden": true }), _jsx("span", { children: "Mostrar lista" })] }) })) : null] }) }) }), _jsx(Sheet, { open: mobileListOpen, onOpenChange: setMobileListOpen, children: _jsxs(SheetContent, { side: "left", className: cn('w-[min(420px,90vw)] border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] p-0 text-foreground shadow-[var(--shadow-lg)]', 'border-r'), children: [_jsx(SheetHeader, { className: "sr-only", children: _jsx(SheetTitle, { children: "Lista de tickets" }) }), mobileListContent] }) })] }));
};
export default InboxAppShell;
