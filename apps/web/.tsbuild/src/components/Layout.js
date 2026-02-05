import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Menu, Home, Users, Layers, QrCode, MessageSquare, Megaphone, Settings, Ticket, Bell, Search, User, LogOut, ChevronsLeft, ChevronsRight, Sun, Moon, ScrollText, } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils.js';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { useAuth } from '@/features/auth/AuthProvider.jsx';
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarSeparator, useSidebar, } from '@/components/ui/sidebar.jsx';
import HealthIndicator from './HealthIndicator.jsx';
import TenantSelector from './TenantSelector.jsx';
import { CONTEXTUAL_NAVIGATION_IDS, NAVIGATION_PAGES, PRIMARY_NAVIGATION_IDS } from '@/features/navigation/routes.ts';
const NAVIGATION_ICON_MAP = {
    [NAVIGATION_PAGES.dashboard.id]: Home,
    [NAVIGATION_PAGES.channels.id]: QrCode,
    [NAVIGATION_PAGES.campaigns.id]: Megaphone,
    [NAVIGATION_PAGES.inbox.id]: MessageSquare,
    [NAVIGATION_PAGES.contacts.id]: Users,
    [NAVIGATION_PAGES.crm.id]: Layers,
    [NAVIGATION_PAGES['baileys-logs'].id]: ScrollText,
    [NAVIGATION_PAGES.settings.id]: Settings,
};
const NAVIGATION_ITEMS = (() => {
    const buildNavigationSection = (ids) => ids
        .map((id) => {
        const definition = NAVIGATION_PAGES[id];
        if (!definition) {
            return null;
        }
        const IconComponent = NAVIGATION_ICON_MAP[id] ?? Menu;
        return { ...definition, icon: IconComponent };
    })
        .filter(Boolean);
    return {
        primary: buildNavigationSection(PRIMARY_NAVIGATION_IDS),
        contextual: buildNavigationSection(CONTEXTUAL_NAVIGATION_IDS),
    };
})();
const LayoutHeader = ({ children, className }) => (_jsx("header", { className: cn('flex h-16 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:px-6', className), children: children }));
const LayoutContent = ({ children, className, stickyFooterPaddingClass, paddingVariant = 'default', disableInnerWrapper = false, }) => {
    const containerClassName = cn('page-content flex flex-1 min-h-0 flex-col', className);
    if (disableInnerWrapper) {
        return (_jsx("div", { className: cn(containerClassName, stickyFooterPaddingClass), children: children }));
    }
    return (_jsx("div", { className: containerClassName, children: _jsx("div", { className: cn('page-content-inner mx-auto flex w-full max-w-7xl flex-1 min-h-0 flex-col gap-6 overflow-y-auto', paddingVariant === 'none' ? 'p-0' : 'p-6 md:p-8', stickyFooterPaddingClass), children: children }) }));
};
const OnboardingTrack = ({ stages, activeStep }) => {
    if (!stages?.length) {
        return null;
    }
    return (_jsx("div", { className: "inline-flex flex-wrap items-center gap-2 rounded-full border border-border/60 bg-muted/60 p-1.5 pr-2 text-xs", children: stages.map((stage, index) => {
            const status = index < activeStep ? 'done' : index === activeStep ? 'current' : 'todo';
            return (_jsxs("div", { className: cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium transition-colors', status === 'done' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300', status === 'current' && 'bg-primary/10 text-primary', status === 'todo' && 'text-muted-foreground'), children: [_jsx("span", { className: cn('flex size-5 items-center justify-center rounded-full border text-[0.65rem] font-semibold', status === 'done' && 'border-transparent bg-emerald-500 text-emerald-50', status === 'current' && 'border-transparent bg-primary text-primary-foreground', status === 'todo' && 'border-transparent bg-muted text-muted-foreground'), children: index + 1 }), _jsx("span", { className: "whitespace-nowrap", children: stage.label })] }, stage.id));
        }) }));
};
const LayoutShell = ({ children, navigation, currentPage, onNavigate, shouldShowOnboardingTrack, stageList, activeOnboardingStep, isDarkMode, themeMounted, setTheme, contentPaddingVariant = 'default', disableContentInnerWrapper = false, fullWidthContent = false, }) => {
    const { isMobile, state, setOpen, setOpenMobile, toggleSidebar } = useSidebar();
    const isSidebarCollapsed = state === 'collapsed';
    const { user, logout, status: authStatus } = useAuth();
    const displayName = user?.name ?? 'Operador';
    const displayRole = user?.role ?? 'Sem papel definido';
    const handleLogout = () => {
        logout?.();
    };
    const handleNavigate = (page) => (event) => {
        event.preventDefault();
        onNavigate?.(page);
        if (isMobile) {
            setOpenMobile(false);
        }
    };
    const navigationSections = navigation ?? { primary: [], contextual: [] };
    const renderNavigationItems = useCallback((items) => items.map((item) => (_jsx(SidebarMenuItem, { children: _jsxs(SidebarMenuButton, { type: "button", onClick: handleNavigate(item.id), isActive: currentPage === item.id, tooltip: item.label, "aria-label": item.label, children: [_jsx(item.icon, { className: "h-4 w-4" }), _jsx("span", { className: "truncate group-data-[collapsible=icon]:hidden", children: item.label })] }) }, item.id))), [currentPage, handleNavigate]);
    const handleSidebarCollapseToggle = () => {
        if (isMobile) {
            setOpenMobile(true);
            return;
        }
        toggleSidebar();
    };
    const handleMobileSidebarOpen = () => {
        if (isMobile) {
            setOpenMobile(true);
        }
        else {
            setOpen(true);
        }
    };
    return (_jsxs("div", { className: "flex h-full min-h-0 w-full overflow-hidden bg-background text-foreground", children: [_jsxs(Sidebar, { collapsible: "icon", variant: "inset", children: [_jsx(SidebarHeader, { className: "border-b border-sidebar-border px-4 py-4", children: _jsxs("div", { className: "flex w-full items-center gap-3", children: [_jsxs("div", { className: "flex flex-1 items-center gap-3 group-data-[collapsible=icon]:justify-center", children: [_jsx("div", { className: "flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary", children: _jsx(Ticket, { className: "h-5 w-5" }) }), _jsxs("div", { className: "space-y-1 group-data-[collapsible=icon]:hidden", children: [_jsx("p", { className: "text-sm font-semibold leading-none", children: "Lead Engine" }), _jsx("p", { className: "text-xs text-muted-foreground", children: "M\u00E1quina de Vendas" })] })] }), _jsx(Button, { type: "button", variant: "ghost", size: "icon", className: "h-8 w-8 text-muted-foreground group-data-[collapsible=icon]:flex", onClick: toggleSidebar, "aria-label": isSidebarCollapsed ? 'Expandir menu' : 'Recolher menu', children: isSidebarCollapsed ? (_jsx(ChevronsRight, { className: "h-4 w-4", "aria-hidden": "true" })) : (_jsx(ChevronsLeft, { className: "h-4 w-4", "aria-hidden": "true" })) })] }) }), _jsxs(SidebarContent, { className: "px-2 py-4", children: [_jsx(SidebarGroup, { children: _jsx(SidebarGroupContent, { children: _jsx(SidebarMenu, { children: renderNavigationItems(navigationSections.primary) }) }) }), navigationSections.contextual.length > 0 ? (_jsxs(_Fragment, { children: [_jsx(SidebarSeparator, {}), _jsxs(SidebarGroup, { children: [_jsx(SidebarGroupLabel, { children: "Contexto" }), _jsx(SidebarGroupContent, { children: _jsx(SidebarMenu, { children: renderNavigationItems(navigationSections.contextual) }) })] })] })) : null] }), _jsx(SidebarFooter, { className: "border-t border-sidebar-border px-4 py-4", children: _jsxs("div", { className: "flex items-center gap-3 group-data-[collapsible=icon]:justify-center", children: [_jsx("div", { className: "flex size-9 items-center justify-center rounded-full bg-primary/15 text-primary", children: _jsx(User, { className: "h-5 w-5" }) }), _jsxs("div", { className: "min-w-0 flex-1 space-y-0.5 group-data-[collapsible=icon]:hidden", children: [_jsx("p", { className: "truncate text-sm font-medium leading-none", children: displayName }), _jsx("p", { className: "text-xs text-muted-foreground", children: displayRole })] }), _jsxs(Button, { variant: "ghost", size: "icon", className: "h-8 w-8", onClick: handleLogout, disabled: authStatus === 'checking', children: [_jsx(LogOut, { className: "h-4 w-4" }), _jsx("span", { className: "sr-only", children: "Sair" })] })] }) })] }), _jsxs(SidebarInset, { className: "flex h-full min-h-0 flex-1 flex-col overflow-hidden", children: [_jsxs(LayoutHeader, { children: [_jsxs("div", { className: "flex min-w-0 flex-1 items-center gap-3", children: [_jsx(Button, { variant: "ghost", size: "icon", className: "md:hidden", onClick: handleMobileSidebarOpen, "aria-label": "Abrir navega\u00E7\u00E3o", children: _jsx(Menu, { className: "h-5 w-5" }) }), _jsxs("div", { className: "relative hidden min-w-0 flex-1 items-center sm:flex", children: [_jsx(Search, { className: "pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" }), _jsx(Input, { type: "search", placeholder: "Buscar tickets, contatos...", className: "h-9 w-full rounded-lg border border-border bg-muted/40 pl-9 text-sm shadow-none placeholder:text-muted-foreground" })] })] }), _jsxs("div", { className: "flex items-center gap-2 sm:gap-3", children: [_jsxs(Button, { variant: "ghost", size: "icon", onClick: () => setTheme(isDarkMode ? 'light' : 'dark'), "aria-label": isDarkMode ? 'Ativar tema claro' : 'Ativar tema escuro', title: isDarkMode ? 'Ativar tema claro' : 'Ativar tema escuro', children: [themeMounted ? (isDarkMode ? (_jsx(Moon, { className: "h-5 w-5", "aria-hidden": "true" })) : (_jsx(Sun, { className: "h-5 w-5", "aria-hidden": "true" }))) : (_jsx(Sun, { className: "h-5 w-5 opacity-0", "aria-hidden": "true" })), _jsx("span", { className: "sr-only", children: "Alternar tema" })] }), _jsx(TenantSelector, {}), _jsxs(Button, { variant: "ghost", size: "icon", className: "relative", children: [_jsx(Bell, { className: "h-5 w-5" }), _jsx("span", { className: "absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[0.65rem] font-medium text-primary-foreground", children: "5" })] }), _jsx(HealthIndicator, {})] })] }), _jsx("div", { className: "px-4 py-4 sm:hidden", children: _jsxs("div", { className: "relative", children: [_jsx(Search, { className: "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" }), _jsx(Input, { type: "search", placeholder: "Buscar tickets, contatos...", className: "h-9 w-full rounded-lg border border-border bg-muted/40 pl-9 text-sm shadow-none placeholder:text-muted-foreground" })] }) }), _jsxs(LayoutContent, { className: "h-full min-h-0", paddingVariant: contentPaddingVariant, disableInnerWrapper: disableContentInnerWrapper || fullWidthContent, children: [shouldShowOnboardingTrack ? (_jsx(OnboardingTrack, { stages: stageList, activeStep: activeOnboardingStep })) : null, children] })] })] }));
};
const Layout = ({ children, currentPage = 'dashboard', onNavigate, onboarding, fullWidthContent = false, }) => {
    const [inboxCount, setInboxCount] = useState(typeof onboarding?.metrics?.inboxCount === 'number' ? onboarding.metrics.inboxCount : null);
    const [themeMounted, setThemeMounted] = useState(false);
    const { resolvedTheme, setTheme } = useTheme();
    useEffect(() => {
        if (typeof onboarding?.metrics?.inboxCount === 'number') {
            setInboxCount(onboarding.metrics.inboxCount);
        }
    }, [onboarding?.metrics?.inboxCount]);
    useEffect(() => {
        setThemeMounted(true);
    }, []);
    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }
        const handler = (event) => {
            if (typeof event?.detail === 'number') {
                setInboxCount(event.detail);
            }
        };
        window.addEventListener('leadengine:inbox-count', handler);
        return () => window.removeEventListener('leadengine:inbox-count', handler);
    }, []);
    const navigation = useMemo(() => {
        const mapItems = (items) => items.map((item) => {
            if (item.id !== 'inbox') {
                return item;
            }
            const inboxLabel = typeof inboxCount === 'number' ? `Inbox (${inboxCount})` : 'Inbox';
            return {
                ...item,
                label: inboxLabel,
            };
        });
        return {
            primary: mapItems(NAVIGATION_ITEMS.primary),
            contextual: mapItems(NAVIGATION_ITEMS.contextual),
        };
    }, [inboxCount]);
    const stageList = onboarding?.stages ?? [];
    const shouldShowOnboardingTrack = stageList.length > 0 && currentPage !== 'inbox';
    const isDarkMode = themeMounted ? resolvedTheme === 'dark' : false;
    const activeOnboardingStep = onboarding?.activeStep ?? 0;
    const isInboxPage = currentPage === 'inbox';
    const contentPaddingVariant = isInboxPage ? 'none' : 'default';
    const shouldDisableContentInnerWrapper = isInboxPage;
    return (_jsx(SidebarProvider, { defaultOpen: false, children: _jsx(LayoutShell, { navigation: navigation, currentPage: currentPage, onNavigate: onNavigate, shouldShowOnboardingTrack: shouldShowOnboardingTrack, stageList: stageList, activeOnboardingStep: activeOnboardingStep, isDarkMode: isDarkMode, themeMounted: themeMounted, setTheme: setTheme, contentPaddingVariant: contentPaddingVariant, disableContentInnerWrapper: shouldDisableContentInnerWrapper, fullWidthContent: fullWidthContent, children: children }) }));
};
export default Layout;
