import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
    const handleNavigate = useCallback((page) => {
        if (page === 'contacts') {
            return;
        }
        dispatchNavigateEvent(page);
        navigate('/', { replace: page === 'dashboard' });
    }, [navigate]);
    return (_jsx(Layout, { currentPage: "contacts", onNavigate: handleNavigate, children: _jsx(Suspense, { fallback: _jsx(PageFallback, {}), children: _jsx(Outlet, {}) }) }));
};
const ContactsModule = () => (_jsx(Routes, { children: _jsxs(Route, { element: _jsx(ContactsLayoutShell, {}), children: [_jsx(Route, { index: true, element: _jsx(ContactsPage, {}) }), _jsx(Route, { path: ":contactId/*", element: _jsx(ContactDetailsPage, {}) })] }) }));
export default ContactsModule;
