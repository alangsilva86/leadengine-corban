import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ArrowRight, Loader2, Plus } from 'lucide-react';
import { Button } from './button.jsx';
export default {
    title: 'Componentes/Base/Button',
    component: Button,
    tags: ['autodocs'],
    argTypes: {
        variant: {
            control: 'select',
            options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
        },
        size: {
            control: 'select',
            options: ['sm', 'default', 'lg', 'icon'],
        },
    },
    args: {
        children: 'Ação principal',
        variant: 'default',
        size: 'default',
    },
};
export const Playground = {
    args: {
        children: 'Ação principal',
    },
};
export const ComIcone = {
    render: (args) => (_jsxs(Button, { ...args, children: [_jsx("span", { children: "Continuar" }), _jsx(ArrowRight, { className: "size-4", "aria-hidden": true })] })),
    args: {
        variant: 'default',
        size: 'default',
    },
};
export const Circular = {
    args: {
        variant: 'secondary',
        size: 'icon',
        children: _jsx(Plus, { className: "size-5", "aria-hidden": true }),
        'aria-label': 'Adicionar',
    },
};
export const Carregando = {
    render: (args) => (_jsxs(Button, { ...args, disabled: true, children: [_jsx(Loader2, { className: "size-4 animate-spin", "aria-hidden": true }), "Processando"] })),
    args: {
        variant: 'default',
        size: 'default',
    },
};
