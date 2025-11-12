import { Suspense, lazy, useCallback } from 'react';
import { RouterProvider, createBrowserRouter, Navigate, useNavigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import './App.css';
import useOnboardingJourney from './features/onboarding/useOnboardingJourney.js';

const ContactsModule = lazy(() => import('./features/contacts/ContactsModule.jsx'));
const CrmModule = lazy(() => import('./features/crm/CrmModule.jsx'));

export const PageFallback = () => (
  <div className="flex min-h-[200px] items-center justify-center text-muted-foreground">
    Carregando módulo...
  </div>
);

const dispatchGlobalNavigation = (targetPage) => {
  if (typeof window === 'undefined') {
    return;
  }

  const event = new CustomEvent('leadengine:navigate', { detail: targetPage });
  window.dispatchEvent(event);
};

const OnboardingRoute = ({ initialPage }) => {
  const navigate = useNavigate();
  const { safeCurrentPage, onboarding, handleNavigate, renderPage } = useOnboardingJourney({
    initialPage,
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
      <Suspense fallback={<PageFallback />}>{renderPage()}</Suspense>
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

const router = createBrowserRouter([
  {
    path: '/',
    element: <OnboardingRoute initialPage={null} />,
  },
  {
    path: '/channels',
    element: <OnboardingRoute initialPage="channels" />,
  },
  {
    path: '/campaigns',
    element: <OnboardingRoute initialPage="campaigns" />,
  },
  {
    path: '/contacts/*',
    element: <ContactsBoundary />,
  },
  {
    path: '/crm/*',
    element: <CrmBoundary />,
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);

function App() {
  return <RouterProvider router={router} fallbackElement={<PageFallback />} />;
}

export default App;
