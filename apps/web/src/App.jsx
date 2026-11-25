import { Suspense, lazy, useEffect } from 'react';
import {
  RouterProvider,
  createBrowserRouter,
  Link,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
  useRouteError,
  isRouteErrorResponse,
} from 'react-router-dom';
import { Compass, Lock, RotateCw } from 'lucide-react';
import Layout from './components/Layout.jsx';
import './App.css';
import { Button } from '@/components/ui/button.jsx';
import { EmptyState } from '@/components/page/EmptyState.jsx';
import { PageSkeleton } from '@/components/page/PageSkeleton.jsx';
import BrandMark from '@/components/shell/BrandMark.jsx';
import { useDocumentTitle } from '@/hooks/use-document-title.js';
import { getFriendlyErrorMessage } from '@/lib/errors.js';
import AuthProvider, { useAuth } from './features/auth/AuthProvider.jsx';
import LoginPage from './features/auth/Login.tsx';
import { WhatsAppInstancesProvider } from '@/features/whatsapp/hooks/useWhatsAppInstances.jsx';
import { canAccessPage } from '@/features/navigation/routes.ts';

const ContactsModule = lazy(() => import('./features/contacts/ContactsModule.jsx'));
const CrmModule = lazy(() => import('./features/crm/CrmModule.jsx'));
const Dashboard = lazy(() => import('./components/Dashboard.jsx'));
const WhatsAppConnect = lazy(() => import('./features/whatsapp/connect/index'));
const WhatsAppCampaigns = lazy(() => import('./features/whatsapp/campaigns/index'));
const ChatCommandCenter = lazy(() => import('./features/chat/containers/ChatCommandCenterContainer.tsx'));
const Settings = lazy(() => import('./components/Settings.jsx'));

/** Mantido por compatibilidade com módulos que importam o fallback daqui. */
export const PageFallback = () => <PageSkeleton />;

const FullScreenStatus = ({ title, children }) => (
  <main className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background p-6 text-center">
    <BrandMark className="size-10" />
    <div className="space-y-1">
      <p className="text-sm font-medium text-foreground" role="status" aria-live="polite">
        {title}
      </p>
      {children}
    </div>
  </main>
);

const RouteErrorBoundary = () => {
  const error = useRouteError();
  const navigate = useNavigate();
  useDocumentTitle('Algo deu errado');

  const status = isRouteErrorResponse(error) ? error.status : error?.status;
  if (status === 404) {
    return <NotFoundPage />;
  }

  const technical = isRouteErrorResponse(error)
    ? `HTTP ${error.status} ${error.statusText ?? ''}`.trim()
    : error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : null;

  return (
    <EmptyState
      role="alert"
      tone="error"
      icon={RotateCw}
      title="Algo deu errado ao abrir esta página"
      description={`${getFriendlyErrorMessage(error, 'Tente de novo. Se o problema continuar, envie os detalhes abaixo para o suporte.')}`}
      action={
        <Button type="button" onClick={() => window.location.reload()}>
          Tentar de novo
        </Button>
      }
      secondaryAction={
        <Button type="button" variant="outline" onClick={() => navigate('/', { replace: true })}>
          Ir para a visão geral
        </Button>
      }
      className="min-h-[50vh]"
    >
      {technical ? (
        <details className="max-w-md text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none">Detalhes técnicos</summary>
          <p className="mt-1 break-words font-mono">{technical}</p>
        </details>
      ) : null}
    </EmptyState>
  );
};

const NotFoundPage = () => {
  useDocumentTitle('Página não encontrada');
  return (
    <EmptyState
      icon={Compass}
      title="Página não encontrada"
      description="O endereço pode ter mudado ou não existe mais."
      action={
        <Button asChild>
          <Link to="/">Ir para a visão geral</Link>
        </Button>
      }
      secondaryAction={
        <Button asChild variant="outline">
          <Link to="/inbox">Abrir o Inbox</Link>
        </Button>
      }
      className="min-h-[50vh]"
    />
  );
};

/** Bloqueia páginas por papel com uma explicação, em vez de deixar a tela quebrar com 403. */
const RequirePage = ({ pageId, children }) => {
  const { user } = useAuth();
  if (canAccessPage(pageId, user?.role)) {
    return children;
  }
  return (
    <EmptyState
      icon={Lock}
      title="Você não tem acesso a esta página"
      description="Peça a um administrador da sua empresa para liberar o acesso."
      action={
        <Button asChild variant="outline">
          <Link to="/inbox">Voltar para o Inbox</Link>
        </Button>
      }
      className="min-h-[50vh]"
    />
  );
};

const AuthenticatedWorkspace = () => {
  const { status, loading, user, tenantId, refresh } = useAuth();
  const location = useLocation();

  if (status === 'checking' || loading) {
    return <FullScreenStatus title="Entrando…" />;
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  if (status !== 'authenticated' || !user || !tenantId) {
    return (
      <FullScreenStatus title="Não conseguimos confirmar sua sessão.">
        <p className="text-sm text-muted-foreground">Tente de novo ou entre novamente.</p>
        <div className="flex justify-center gap-2 pt-3">
          <Button onClick={refresh}>Tentar de novo</Button>
          <Button variant="outline" asChild>
            <Link to="/logout">Entrar novamente</Link>
          </Button>
        </div>
      </FullScreenStatus>
    );
  }

  return (
    <WhatsAppInstancesProvider key={`${tenantId}:${user.id}`} tenantId={tenantId} autoRefresh initialFetch>
      <Outlet />
    </WhatsAppInstancesProvider>
  );
};

/** Shell montado uma única vez; só o conteúdo troca entre páginas. */
const AppLayout = () => (
  <Layout>
    <Suspense fallback={<PageSkeleton />}>
      <Outlet />
    </Suspense>
  </Layout>
);

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

  return <FullScreenStatus title="Saindo…" />;
};

const page = (path, element) => ({ path, element, errorElement: <RouteErrorBoundary /> });

const router = createBrowserRouter([
  {
    element: <AuthenticatedWorkspace />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        element: <AppLayout />,
        errorElement: <RouteErrorBoundary />,
        children: [
          { index: true, element: <Dashboard />, errorElement: <RouteErrorBoundary /> },
          page('inbox', <ChatCommandCenter />),
          page('contacts/*', <ContactsModule />),
          page('crm/*', <CrmModule />),
          page(
            'channels',
            <RequirePage pageId="channels">
              <WhatsAppConnect />
            </RequirePage>,
          ),
          page(
            'routing-rules',
            <RequirePage pageId="campaigns">
              <WhatsAppCampaigns />
            </RequirePage>,
          ),
          page('settings', <Settings />),
          page('settings/:section', <Settings />),
          // URLs antigas
          { path: 'campaigns', element: <Navigate to="/routing-rules" replace /> },
          { path: 'baileys-logs', element: <Navigate to="/settings/diagnostics" replace /> },
          { path: 'whatsapp', element: <Navigate to="/channels" replace /> },
          { path: 'whatsapp/inbox', element: <Navigate to="/inbox" replace /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
  { path: '/login', element: <LoginPage />, errorElement: <RouteErrorBoundary /> },
  { path: '/logout', element: <LogoutRoute /> },
]);

function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} fallbackElement={<FullScreenStatus title="Carregando…" />} />
    </AuthProvider>
  );
}

export default App;
