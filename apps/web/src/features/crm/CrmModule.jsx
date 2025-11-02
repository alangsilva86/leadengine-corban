import { Suspense, lazy, useCallback } from 'react';
import { Routes, Route, Outlet, useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout.jsx';
import { PageFallback } from '@/App.jsx';

const CrmHomePage = lazy(() => import('./pages/CrmHomePage.tsx'));
const LeadDetailsPage = lazy(() => import('./pages/LeadDetailsPage.jsx'));

const dispatchNavigateEvent = (page) => {
  if (typeof window === 'undefined') {
    return;
  }

  const event = new CustomEvent('leadengine:navigate', { detail: page });
  window.dispatchEvent(event);
};

const CrmLayoutShell = () => {
  const navigate = useNavigate();

  const handleNavigate = useCallback((targetPage) => {
    if (targetPage === 'crm') {
      return;
    }

    dispatchNavigateEvent(targetPage);

    if (targetPage === 'contacts') {
      navigate('/contacts');
      return;
    }

    navigate('/', { replace: targetPage === 'dashboard' });
  }, [navigate]);

  return (
    <Layout currentPage="crm" onNavigate={handleNavigate}>
      <Suspense fallback={<PageFallback />}>
        <Outlet />
      </Suspense>
    </Layout>
  );
};

const CrmModule = () => (
  <Routes>
    <Route element={<CrmLayoutShell />}>
      <Route index element={<CrmHomePage />} />
      <Route path="leads/:leadId/*" element={<LeadDetailsPage />} />
    </Route>
  </Routes>
);

export default CrmModule;
