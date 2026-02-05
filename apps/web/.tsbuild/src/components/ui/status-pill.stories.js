import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Check, CircleDashed, MessageCircle, X } from 'lucide-react';
import { StatusPill } from './status-pill.jsx';
const toneOptions = ['neutral', 'primary', 'success', 'warning', 'danger', 'whatsapp'];
export default {
    title: 'Componentes/Base/StatusPill',
    component: StatusPill,
    tags: ['autodocs'],
    argTypes: {
        tone: {
            control: 'select',
            options: toneOptions,
        },
        size: {
            control: 'select',
            options: ['sm', 'md', 'lg'],
        },
        withDot: {
            control: 'boolean',
        },
    },
    args: {
        tone: 'neutral',
        size: 'md',
        withDot: true,
        children: 'Em conversa',
    },
};
export const Playground = {
    args: {
        tone: 'neutral',
        children: 'Em conversa',
    },
};
export const ComIcone = {
    render: (args) => (_jsxs(StatusPill, { ...args, children: [_jsx(Check, { className: "size-3.5", "aria-hidden": true }), "Lead ganhado"] })),
    args: {
        tone: 'success',
        withDot: false,
    },
};
export const Estados = {
    render: (args) => (_jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [_jsxs(StatusPill, { ...args, tone: "neutral", children: [_jsx(CircleDashed, { className: "size-3.5", "aria-hidden": true }), "Novo lead"] }), _jsxs(StatusPill, { ...args, tone: "primary", children: [_jsx(MessageCircle, { className: "size-3.5", "aria-hidden": true }), "Respondendo"] }), _jsxs(StatusPill, { ...args, tone: "success", children: [_jsx(Check, { className: "size-3.5", "aria-hidden": true }), "Ganhou"] }), _jsxs(StatusPill, { ...args, tone: "danger", children: [_jsx(X, { className: "size-3.5", "aria-hidden": true }), "Perdido"] }), _jsxs(StatusPill, { ...args, tone: "whatsapp", children: [_jsx(MessageCircle, { className: "size-3.5", "aria-hidden": true }), "WhatsApp"] })] })),
    args: {
        withDot: false,
        size: 'md',
    },
    parameters: {
        controls: {
            exclude: ['children', 'tone'],
        },
    },
};
