import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Suspense, lazy, useCallback, useEffect } from 'react';
import { RouterProvider, createBrowserRouter, Navigate, useNavigate, useRouteError, isRouteErrorResponse, } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import './App.css';
import { Button } from '@/components/ui/button.jsx';
import AuthProvider, { useAuth } from './features/auth/AuthProvider.jsx';
import LoginPage from './features/auth/Login.tsx';
import { NAVIGATION_PAGES } from '@/features/navigation/routes.ts';
const ContactsModule = lazy(() => import('./features/contacts/ContactsModule.jsx'));
const CrmModule = lazy(() => import('./features/crm/CrmModule.jsx'));
const Dashboard = lazy(() => import('./components/Dashboard.jsx'));
const WhatsAppConnect = lazy(() => import('./features/whatsapp/connect/index'));
const WhatsAppCampaigns = lazy(() => import('./features/whatsapp/campaigns/index'));
const ChatCommandCenter = lazy(() => import('./features/chat/containers/ChatCommandCenterContainer.js'));
const Settings = lazy(() => import('./components/Settings.jsx'));
const BaileysLogs = lazy(() => import('./features/debug/BaileysLogs.jsx'));
export const PageFallback = () => (_jsx("div", { className: "flex min-h-[200px] items-center justify-center text-muted-foreground", children: "Carregando m\u00F3dulo..." }));
const RouteErrorBoundary = () => {
    const navigate = useNavigate();
    const error = useRouteError();
    const routeErrorInfo = isRouteErrorResponse(error)
        ? {
            status: error.status,
            statusText: error.statusText,
            data: error.data,
        }
        : null;
    const resolvedMessage = (() => {
        if (routeErrorInfo) {
            if (typeof routeErrorInfo.data === 'string') {
                return routeErrorInfo.data;
            }
            if (routeErrorInfo.data?.message) {
                return routeErrorInfo.data.message;
            }
            return `Código ${routeErrorInfo.status} - ${routeErrorInfo.statusText}`;
        }
        if (error instanceof Error) {
            return error.message;
        }
        if (typeof error === 'string') {
            return error;
        }
        return null;
    })();
    const handleRetry = () => {
        if (typeof window !== 'undefined') {
            window.location.reload();
        }
    };
    return (_jsxs("div", { className: "flex min-h-[320px] flex-col items-center justify-center gap-6 px-6 text-center", children: [_jsxs("div", { className: "space-y-2", children: [_jsx("h1", { className: "text-2xl font-semibold text-foreground", children: "Ops! Algo saiu do previsto." }), _jsx("p", { className: "max-w-xl text-sm text-muted-foreground", children: "Revise a a\u00E7\u00E3o anterior, tente novamente ou volte para a vis\u00E3o geral enquanto verificamos os detalhes." })] }), resolvedMessage ? (_jsx("pre", { className: "max-w-xl whitespace-pre-wrap rounded-md bg-muted px-4 py-3 text-left text-sm text-muted-foreground", children: resolvedMessage })) : null, _jsxs("div", { className: "flex flex-wrap justify-center gap-3", children: [_jsx(Button, { type: "button", onClick: () => navigate('/', { replace: true }), children: "Ir para o painel" }), _jsx(Button, { type: "button", variant: "outline", onClick: handleRetry, children: "Tentar novamente" })] })] }));
};
const LayoutRoute = ({ currentPage, fullWidthContent = false, children }) => {
    const navigate = useNavigate();
    const handleRouteNavigate = useCallback((nextPage) => {
        const definition = NAVIGATION_PAGES[nextPage];
        if (definition?.path) {
            navigate(definition.path);
        }
    }, [navigate]);
    return (_jsx(Layout, { currentPage: currentPage, onNavigate: handleRouteNavigate, onboarding: null, fullWidthContent: fullWidthContent, children: _jsx(Suspense, { fallback: _jsx(PageFallback, {}), children: children }) }));
};
const ContactsBoundary = () => (_jsx(Suspense, { fallback: _jsx(PageFallback, {}), children: _jsx(ContactsModule, {}) }));
const CrmBoundary = () => (_jsx(Suspense, { fallback: _jsx(PageFallback, {}), children: _jsx(CrmModule, {}) }));
const AuthGate = ({ children }) => {
    const { status, loading } = useAuth();
    if (status === 'checking' || loading) {
        return (_jsx("div", { className: "flex min-h-screen items-center justify-center text-muted-foreground", children: "Validando sess\u00E3o..." }));
    }
    if (status === 'unauthenticated') {
        return _jsx(Navigate, { to: "/login", replace: true });
    }
    return children;
};
const LogoutRoute = () => {
    const { logout } = useAuth();
    const navigate = useNavigate();
    useEffect(() => {
        let mounted = true;
        const run = async () => {
            try {
                await logout?.();
            }
            finally {
                if (mounted) {
                    navigate('/login', { replace: true });
                }
            }
        };
        run();
        return () => {
            mounted = false;
        };
    }, [logout, navigate]);
    return _jsx(PageFallback, {});
};
const router = createBrowserRouter([
    {
        path: '/',
        element: (_jsx(AuthGate, { children: _jsx(LayoutRoute, { currentPage: NAVIGATION_PAGES.dashboard.id, children: _jsx(Dashboard, {}) }) })),
        errorElement: _jsx(RouteErrorBoundary, {}),
    },
    {
        path: '/channels',
        element: (_jsx(AuthGate, { children: _jsx(LayoutRoute, { currentPage: NAVIGATION_PAGES.channels.id, children: _jsx(WhatsAppConnect, {}) }) })),
        errorElement: _jsx(RouteErrorBoundary, {}),
    },
    {
        path: '/campaigns',
        element: (_jsx(AuthGate, { children: _jsx(LayoutRoute, { currentPage: NAVIGATION_PAGES.campaigns.id, children: _jsx(WhatsAppCampaigns, {}) }) })),
        errorElement: _jsx(RouteErrorBoundary, {}),
    },
    {
        path: '/inbox',
        element: (_jsx(AuthGate, { children: _jsx(LayoutRoute, { currentPage: NAVIGATION_PAGES.inbox.id, fullWidthContent: true, children: _jsx(ChatCommandCenter, {}) }) })),
        errorElement: _jsx(RouteErrorBoundary, {}),
    },
    {
        path: '/settings',
        element: (_jsx(AuthGate, { children: _jsx(LayoutRoute, { currentPage: NAVIGATION_PAGES.settings.id, children: _jsx(Settings, {}) }) })),
        errorElement: _jsx(RouteErrorBoundary, {}),
    },
    {
        path: '/baileys-logs',
        element: (_jsx(AuthGate, { children: _jsx(LayoutRoute, { currentPage: NAVIGATION_PAGES['baileys-logs'].id, children: _jsx(BaileysLogs, {}) }) })),
        errorElement: _jsx(RouteErrorBoundary, {}),
    },
    {
        path: '/contacts/*',
        element: (_jsx(AuthGate, { children: _jsx(ContactsBoundary, {}) })),
        errorElement: _jsx(RouteErrorBoundary, {}),
    },
    {
        path: '/crm/*',
        element: (_jsx(AuthGate, { children: _jsx(CrmBoundary, {}) })),
        errorElement: _jsx(RouteErrorBoundary, {}),
    },
    {
        path: '/login',
        element: _jsx(LoginPage, {}),
        errorElement: _jsx(RouteErrorBoundary, {}),
    },
    {
        path: '/logout',
        element: (_jsx(AuthGate, { children: _jsx(LogoutRoute, {}) })),
        errorElement: _jsx(RouteErrorBoundary, {}),
    },
    {
        path: '*',
        element: _jsx(Navigate, { to: "/", replace: true }),
        errorElement: _jsx(RouteErrorBoundary, {}),
    },
]);
function App() {
    return (_jsx(AuthProvider, { children: _jsx(RouterProvider, { router: router, fallbackElement: _jsx(PageFallback, {}) }) }));
}
export default App;
