import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Suspense, lazy, useCallback } from 'react';
import { Routes, Route, Outlet, useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout.jsx';
import { PageFallback } from '@/App.jsx';
const CrmHomePage = lazy(() => import('./pages/CrmHomePage'));
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
    return (_jsx(Layout, { currentPage: "crm", onNavigate: handleNavigate, children: _jsx(Suspense, { fallback: _jsx(PageFallback, {}), children: _jsx(Outlet, {}) }) }));
};
const CrmModule = () => (_jsx(Routes, { children: _jsxs(Route, { element: _jsx(CrmLayoutShell, {}), children: [_jsx(Route, { index: true, element: _jsx(CrmHomePage, {}) }), _jsx(Route, { path: "leads/:leadId/*", element: _jsx(LeadDetailsPage, {}) })] }) }));
export default CrmModule;
