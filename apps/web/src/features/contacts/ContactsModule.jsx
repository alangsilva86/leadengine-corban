import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { PageSkeleton } from '@/components/page/PageSkeleton.jsx';

const ContactsPage = lazy(() => import('./pages/ContactsPage.jsx'));
const ContactDetailsPage = lazy(() => import('./pages/ContactDetailsPage.jsx'));

// Renderizado dentro do shell único do app (App.jsx); não monta Layout próprio.
const ContactsModule = () => (
  <Suspense fallback={<PageSkeleton />}>
    <Routes>
      <Route index element={<ContactsPage />} />
      <Route path=":contactId/*" element={<ContactDetailsPage />} />
    </Routes>
  </Suspense>
);

export default ContactsModule;
