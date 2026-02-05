import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import App from './App.jsx';
import { Toaster } from '@/components/ui/sonner.jsx';
import { ThemeProvider } from '@/components/theme/theme-provider.jsx';
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
        },
    },
});
createRoot(document.getElementById('root')).render(_jsx(StrictMode, { children: _jsx(QueryClientProvider, { client: queryClient, children: _jsxs(ThemeProvider, { children: [_jsx(App, {}), _jsx(Toaster, { richColors: true, position: "top-right" })] }) }) }));
