import { Suspense, lazy, useCallback } from 'react';
import { RouterProvider, createBrowserRouter, Navigate, useNavigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import './App.css';
import useOnboardingJourney from './features/onboarding/useOnboardingJourney.js';

const ContactsModule = lazy(() => import('./features/contacts/ContactsModule.jsx'));

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

const OnboardingRoute = () => {
  const navigate = useNavigate();
  const { safeCurrentPage, onboarding, handleNavigate, renderPage } = useOnboardingJourney();

  const handleRouteNavigate = useCallback(
    (nextPage) => {
      if (nextPage === 'contacts') {
        dispatchGlobalNavigation(nextPage);
        navigate('/contacts');
        return;
      }

      handleNavigate(nextPage);
    },
    [handleNavigate, navigate]
  );

  return (
    <Layout currentPage={safeCurrentPage} onNavigate={handleRouteNavigate} onboarding={onboarding}>
      <Suspense fallback={<PageFallback />}>{renderPage()}</Suspense>
    </Layout>
  );
};

const ContactsBoundary = () => (
  <Suspense fallback={<PageFallback />}>
    <ContactsModule />
  </Suspense>
);

const router = createBrowserRouter([
  {
    path: '/',
    element: <OnboardingRoute />,
  },
  {
    path: '/contacts/*',
    element: <ContactsBoundary />,
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
