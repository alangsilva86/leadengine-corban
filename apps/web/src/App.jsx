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
import useOnboardingJourney from './features/onboarding/useOnboardingJourney.js';
import { Button } from '@/components/ui/button.jsx';
import AuthProvider, { useAuth } from './features/auth/AuthProvider.jsx';
import LoginPage from './features/auth/Login.tsx';

const ContactsModule = lazy(() => import('./features/contacts/ContactsModule.jsx'));
const CrmModule = lazy(() => import('./features/crm/CrmModule.jsx'));

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

const dispatchGlobalNavigation = (targetPage) => {
  if (typeof window === 'undefined') {
    return;
  }

  const event = new CustomEvent('leadengine:navigate', { detail: targetPage });
  window.dispatchEvent(event);
};

const OnboardingRoute = ({ initialPage, journeyKind = 'app' }) => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { safeCurrentPage, onboarding, handleNavigate, page } = useOnboardingJourney({
    initialPage,
    currentUser: user,
    loadingCurrentUser: authLoading,
    journeyKind,
  });

  const handleRouteNavigate = useCallback(
    (nextPage) => {
      if (nextPage === 'contacts') {
        dispatchGlobalNavigation(nextPage);
        navigate('/contacts');
        return;
      }

      if (nextPage === 'crm') {
        dispatchGlobalNavigation(nextPage);
        navigate('/crm');
        return;
      }

      if (nextPage === 'channels') {
        dispatchGlobalNavigation(nextPage);
        handleNavigate(nextPage);
        navigate('/channels');
        return;
      }

      if (nextPage === 'campaigns') {
        dispatchGlobalNavigation(nextPage);
        handleNavigate(nextPage);
        navigate('/campaigns');
        return;
      }

      if (nextPage === 'dashboard') {
        dispatchGlobalNavigation(nextPage);
        handleNavigate(nextPage);
        navigate('/');
        return;
      }

      handleNavigate(nextPage);
    },
    [handleNavigate, navigate]
  );

  return (
    <Layout
      currentPage={safeCurrentPage}
      onNavigate={handleRouteNavigate}
      onboarding={onboarding}
      fullWidthContent={safeCurrentPage === 'inbox'}
    >
      <Suspense fallback={<PageFallback />}>{page}</Suspense>
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

const OnboardingPortalRoute = () => {
  const { user, loading: authLoading } = useAuth();
  const { page } = useOnboardingJourney({
    initialPage: 'accept-invite',
    journeyKind: 'invite',
    currentUser: user,
    loadingCurrentUser: authLoading,
  });

  return (
    <Suspense fallback={<PageFallback />}>
      {page}
    </Suspense>
  );
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
        <OnboardingRoute initialPage={null} journeyKind="app" />
      </AuthGate>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/channels',
    element: (
      <AuthGate>
        <OnboardingRoute initialPage="channels" journeyKind="app" />
      </AuthGate>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/campaigns',
    element: (
      <AuthGate>
        <OnboardingRoute initialPage="campaigns" journeyKind="app" />
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
    path: '/onboarding',
    element: <OnboardingPortalRoute />, 
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
