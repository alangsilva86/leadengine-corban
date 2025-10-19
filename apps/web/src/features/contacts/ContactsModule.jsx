import { Suspense, lazy, useCallback } from 'react';
import { Routes, Route, Outlet, useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout.jsx';
import { PageFallback } from '@/App.jsx';

const ContactsPage = lazy(() => import('./pages/ContactsPage.jsx'));
const ContactDetailsPage = lazy(() => import('./pages/ContactDetailsPage.jsx'));

const dispatchNavigateEvent = (page) => {
  if (typeof window === 'undefined') {
    return;
  }

  const event = new CustomEvent('leadengine:navigate', { detail: page });
  window.dispatchEvent(event);
};

const ContactsLayoutShell = () => {
  const navigate = useNavigate();

  const handleNavigate = useCallback(
    (page) => {
      if (page === 'contacts') {
        return;
      }

      dispatchNavigateEvent(page);
      navigate('/', { replace: page === 'dashboard' });
    },
    [navigate]
  );

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
