import { Suspense, lazy, useCallback } from 'react';
import { Routes, Route, Outlet, useNavigate } from 'react-router-dom';
import { NAVIGATION_PAGES } from '@/features/navigation/routes';
import Layout from '@/components/Layout.jsx';
import { PageFallback } from '@/App.jsx';

const ContactsPage = lazy(() => import('./pages/ContactsPage.jsx'));
const ContactDetailsPage = lazy(() => import('./pages/ContactDetailsPage.jsx'));

const ContactsLayoutShell = () => {
  const navigate = useNavigate();

  const handleNavigate = useCallback((page) => {
    const path = NAVIGATION_PAGES[page]?.path;
    if (path) navigate(path);
  }, [navigate]);

  return (
    <Layout currentPage="contacts" onNavigate={handleNavigate}>
      <Suspense fallback={<PageFallback />}>
        <Outlet />
      </Suspense>
    </Layout>
  );
};

const ContactsModule = () => (
  <Routes>
    <Route element={<ContactsLayoutShell />}>
      <Route index element={<ContactsPage />} />
      <Route path=":contactId/*" element={<ContactDetailsPage />} />
    </Route>
  </Routes>
);

export default ContactsModule;
