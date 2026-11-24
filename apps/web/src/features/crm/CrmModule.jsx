import { Suspense, lazy, useCallback } from 'react';
import { Routes, Route, Outlet, useNavigate } from 'react-router-dom';
import { NAVIGATION_PAGES } from '@/features/navigation/routes';
import Layout from '@/components/Layout.jsx';
import { PageFallback } from '@/App.jsx';

const CrmHomePage = lazy(() => import('./pages/CrmHomePage'));
const OpportunitiesPage = lazy(() => import('./pages/OpportunitiesPage'));
const LeadDetailsPage = lazy(() => import('./pages/LeadDetailsPage.jsx'));

const CrmLayoutShell = () => {
  const navigate = useNavigate();

  const handleNavigate = useCallback((page) => {
    const path = NAVIGATION_PAGES[page]?.path;
    if (path) navigate(path);
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
      <Route path="opportunities" element={<OpportunitiesPage />} />
      <Route path="leads/:leadId/*" element={<LeadDetailsPage />} />
    </Route>
  </Routes>
);

export default CrmModule;
