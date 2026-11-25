import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { PageSkeleton } from '@/components/page/PageSkeleton.jsx';

const CrmHomePage = lazy(() => import('./pages/CrmHomePage'));
const OpportunitiesPage = lazy(() => import('./pages/OpportunitiesPage'));
const LeadDetailsPage = lazy(() => import('./pages/LeadDetailsPage.jsx'));

// Renderizado dentro do shell único do app (App.jsx); não monta Layout próprio.
const CrmModule = () => (
  <Suspense fallback={<PageSkeleton />}>
    <Routes>
      <Route index element={<CrmHomePage />} />
      <Route path="opportunities" element={<OpportunitiesPage />} />
      <Route path="leads/:leadId/*" element={<LeadDetailsPage />} />
    </Routes>
  </Suspense>
);

export default CrmModule;
