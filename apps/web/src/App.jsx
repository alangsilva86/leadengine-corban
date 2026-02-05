import { Suspense, lazy, useCallback, useEffect } from 'react';
import {
  RouterProvider,
  createBrowserRouter,
  Navigate,
  useNavigate,
  useRouteError,
  isRouteErrorResponse,
} from 'react-router-dom';
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

export const PageFallback = () => (
  <div className="flex min-h-[200px] items-center justify-center text-muted-foreground">
    Carregando módulo...
  </div>
);

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

  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Ops! Algo saiu do previsto.</h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Revise a ação anterior, tente novamente ou volte para a visão geral enquanto verificamos os detalhes.
        </p>
      </div>
      {resolvedMessage ? (
        <pre className="max-w-xl whitespace-pre-wrap rounded-md bg-muted px-4 py-3 text-left text-sm text-muted-foreground">
          {resolvedMessage}
        </pre>
      ) : null}
      <div className="flex flex-wrap justify-center gap-3">
        <Button type="button" onClick={() => navigate('/', { replace: true })}>
          Ir para o painel
        </Button>
        <Button type="button" variant="outline" onClick={handleRetry}>
          Tentar novamente
        </Button>
      </div>
    </div>
  );
};

const LayoutRoute = ({ currentPage, fullWidthContent = false, children }) => {
  const navigate = useNavigate();

  const handleRouteNavigate = useCallback(
    (nextPage) => {
      const definition = NAVIGATION_PAGES[nextPage];

      if (definition?.path) {
        navigate(definition.path);
      }
    },
    [navigate]
  );

  return (
    <Layout
      currentPage={currentPage}
      onNavigate={handleRouteNavigate}
      onboarding={null}
      fullWidthContent={fullWidthContent}
    >
      <Suspense fallback={<PageFallback />}>{children}</Suspense>
    </Layout>
  );
};

const ContactsBoundary = () => (
  <Suspense fallback={<PageFallback />}>
    <ContactsModule />
  </Suspense>
);

const CrmBoundary = () => (
  <Suspense fallback={<PageFallback />}>
    <CrmModule />
  </Suspense>
);

const AuthGate = ({ children }) => {
  const { status, loading } = useAuth();

  if (status === 'checking' || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Validando sessão...
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
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
      } finally {
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

  return <PageFallback />;
};

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <AuthGate>
        <LayoutRoute currentPage={NAVIGATION_PAGES.dashboard.id}>
          <Dashboard />
        </LayoutRoute>
      </AuthGate>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/channels',
    element: (
      <AuthGate>
        <LayoutRoute currentPage={NAVIGATION_PAGES.channels.id}>
          <WhatsAppConnect />
        </LayoutRoute>
      </AuthGate>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/campaigns',
    element: (
      <AuthGate>
        <LayoutRoute currentPage={NAVIGATION_PAGES.campaigns.id}>
          <WhatsAppCampaigns />
        </LayoutRoute>
      </AuthGate>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/inbox',
    element: (
      <AuthGate>
        <LayoutRoute currentPage={NAVIGATION_PAGES.inbox.id} fullWidthContent>
          <ChatCommandCenter />
        </LayoutRoute>
      </AuthGate>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/settings',
    element: (
      <AuthGate>
        <LayoutRoute currentPage={NAVIGATION_PAGES.settings.id}>
          <Settings />
        </LayoutRoute>
      </AuthGate>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/baileys-logs',
    element: (
      <AuthGate>
        <LayoutRoute currentPage={NAVIGATION_PAGES['baileys-logs'].id}>
          <BaileysLogs />
        </LayoutRoute>
      </AuthGate>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/contacts/*',
    element: (
      <AuthGate>
        <ContactsBoundary />
      </AuthGate>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/crm/*',
    element: (
      <AuthGate>
        <CrmBoundary />
      </AuthGate>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/login',
    element: <LoginPage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/logout',
    element: (
      <AuthGate>
        <LogoutRoute />
      </AuthGate>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
    errorElement: <RouteErrorBoundary />,
  },
]);

function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} fallbackElement={<PageFallback />} />
    </AuthProvider>
  );
}

export default App;
