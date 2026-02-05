import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
const MOCK_TEMPLATES = [
    {
        id: 'template-welcome',
        name: 'Boas-vindas',
        body: 'Olá {{nome}}, sou da Corban. Podemos ajudar com sua proposta?',
    },
    {
        id: 'template-followup',
        name: 'Follow-up 24h',
        body: 'Olá {{nome}}, passando para lembrar do nosso combinado. Podemos prosseguir?',
    },
    {
        id: 'template-docs',
        name: 'Solicitar documentos',
        body: 'Para seguir com a análise, preciso dos documentos anexados. Pode enviar por aqui?',
    },
];
export const TemplatePicker = ({ open, onClose, onSelect }) => {
    return (_jsx(Dialog, { open: open, onOpenChange: (next) => (!next ? onClose?.() : undefined), children: _jsxs(DialogContent, { className: "max-w-md border border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-bold)] text-[color:var(--color-inbox-foreground)] shadow-[var(--shadow-lg)]", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: "Selecionar template aprovado" }), _jsx(DialogDescription, { children: "Escolha um template aprovado para inserir no chat." })] }), _jsx("div", { className: "flex flex-col gap-3", children: MOCK_TEMPLATES.map((template) => (_jsxs("button", { type: "button", className: "rounded-lg border border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] p-3 text-left transition hover:border-[color:var(--accent-inbox-primary)] hover:bg-[color:color-mix(in_srgb,var(--surface-overlay-inbox-bold)_92%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-inbox-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-background", onClick: () => onSelect?.(template), children: [_jsx("div", { className: "text-sm font-semibold text-[color:var(--color-inbox-foreground)]", children: template.name }), _jsx("div", { className: "text-xs text-[color:var(--color-inbox-foreground-muted)]", children: template.body })] }, template.id))) }), _jsx("div", { className: "flex justify-end", children: _jsx(Button, { variant: "ghost", onClick: onClose, children: "Cancelar" }) })] }) }));
};
export default TemplatePicker;
