import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, } from '@/components/ui/dropdown-menu.jsx';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '@/components/ui/dialog.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { cn } from '@/lib/utils.js';
import { FileText, MessageSquarePlus, Plus, Wand2, X } from 'lucide-react';
const sanitizeReply = (reply) => {
    if (!reply)
        return null;
    const label = reply.label?.trim();
    const text = reply.text?.trim();
    if (!label || !text)
        return null;
    return {
        id: reply.id ?? `quick-reply-${label.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
        label,
        text,
    };
};
const QuickReplyMenu = ({ replies = [], onSelect, onCreate, onTemplate, onGenerateAi, onCancelAi, isAiGenerating = false, onCreateNote, className, }) => {
    const [open, setOpen] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [form, setForm] = useState({ label: '', text: '' });
    const availableReplies = useMemo(() => replies.map((reply) => sanitizeReply(reply)).filter(Boolean), [replies]);
    const isSubmitDisabled = !form.label.trim() || !form.text.trim();
    const handleSelect = (reply) => {
        if (typeof onSelect === 'function') {
            onSelect(reply.text, reply);
        }
        setOpen(false);
    };
    const handleCreate = (event) => {
        event.preventDefault();
        const payload = sanitizeReply(form);
        if (!payload) {
            return;
        }
        if (typeof onCreate === 'function') {
            onCreate(payload);
        }
        setForm({ label: '', text: '' });
        setDialogOpen(false);
        setOpen(false);
    };
    return (_jsxs(_Fragment, { children: [_jsxs(DropdownMenu, { open: open, onOpenChange: (value) => setOpen(value), children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsxs(Button, { variant: "ghost", size: "icon", className: cn('h-9 w-9 rounded-full border border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-bold)] text-[color:var(--color-inbox-foreground)] hover:bg-[color:color-mix(in_srgb,var(--surface-overlay-inbox-bold)_92%,transparent)] hover:text-[color:var(--color-inbox-foreground)]', className), children: [_jsx(MessageSquarePlus, { className: "h-4 w-4" }), _jsx("span", { className: "sr-only", children: "Abrir respostas r\u00E1pidas" })] }) }), _jsxs(DropdownMenuContent, { align: "end", className: "w-64 rounded-xl border border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-bold)] p-2 text-[color:var(--color-inbox-foreground)] shadow-[var(--shadow-lg)]", children: [_jsx(DropdownMenuLabel, { className: "text-xs font-semibold uppercase tracking-wide text-[color:var(--color-inbox-foreground-muted)]", children: "Respostas r\u00E1pidas" }), _jsx(DropdownMenuSeparator, { className: "my-1 bg-[color:var(--color-inbox-border)]/70" }), availableReplies.length === 0 ? (_jsx("div", { className: "px-3 py-2 text-xs text-[color:var(--color-inbox-foreground-muted)]", children: "Nenhuma resposta cadastrada ainda." })) : (availableReplies.map((reply) => (_jsxs(DropdownMenuItem, { className: "flex flex-col items-start gap-1 rounded-lg px-3 py-2 text-left text-xs text-[color:var(--color-inbox-foreground)] focus:bg-[color:var(--surface-overlay-inbox-quiet)] focus:text-[color:var(--color-inbox-foreground)]", onSelect: (event) => {
                                    event.preventDefault();
                                    handleSelect(reply);
                                }, children: [_jsx("span", { className: "text-sm font-medium text-[color:var(--color-inbox-foreground)]", children: reply.label }), _jsx("span", { className: "line-clamp-2 text-xs text-[color:var(--color-inbox-foreground-muted)]", children: reply.text })] }, reply.id)))), _jsx(DropdownMenuSeparator, { className: "my-1 bg-[color:var(--color-inbox-border)]/70" }), typeof onTemplate === 'function' ? (_jsxs(DropdownMenuItem, { className: "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[color:var(--color-inbox-foreground)] focus:bg-[color:var(--surface-overlay-inbox-quiet)] focus:text-[color:var(--color-inbox-foreground)]", onSelect: (event) => {
                                    event.preventDefault();
                                    onTemplate();
                                    setOpen(false);
                                }, children: [_jsx(FileText, { className: "h-3.5 w-3.5" }), "Abrir modelos"] })) : null, typeof onCreateNote === 'function' ? (_jsxs(DropdownMenuItem, { className: "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[color:var(--color-inbox-foreground)] focus:bg-[color:var(--surface-overlay-inbox-quiet)] focus:text-[color:var(--color-inbox-foreground)]", onSelect: (event) => {
                                    event.preventDefault();
                                    onCreateNote();
                                    setOpen(false);
                                }, children: [_jsx(FileText, { className: "h-3.5 w-3.5" }), "Nova nota"] })) : null, typeof onGenerateAi === 'function' ? (_jsxs(DropdownMenuItem, { className: "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[color:var(--accent-inbox-primary)] focus:bg-[color:var(--surface-overlay-inbox-quiet)] focus:text-[color:var(--accent-inbox-primary)]", onSelect: (event) => {
                                    event.preventDefault();
                                    onGenerateAi();
                                    setOpen(false);
                                }, disabled: isAiGenerating, children: [_jsx(Wand2, { className: "h-3.5 w-3.5" }), "Gerar com IA"] })) : null, isAiGenerating && typeof onCancelAi === 'function' ? (_jsxs(DropdownMenuItem, { className: "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-status-error focus:bg-[color:var(--surface-overlay-inbox-quiet)] focus:text-status-error", onSelect: (event) => {
                                    event.preventDefault();
                                    onCancelAi();
                                    setOpen(false);
                                }, children: [_jsx(X, { className: "h-3.5 w-3.5" }), "Cancelar IA"] })) : null, _jsx(DropdownMenuSeparator, { className: "my-1 bg-[color:var(--color-inbox-border)]/70" }), _jsxs(DropdownMenuItem, { className: "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium uppercase tracking-wide text-[color:var(--accent-inbox-primary)] focus:bg-[color:var(--surface-overlay-inbox-quiet)] focus:text-[color:var(--accent-inbox-primary)]", onSelect: (event) => {
                                    event.preventDefault();
                                    setDialogOpen(true);
                                }, children: [_jsx(Plus, { className: "h-3.5 w-3.5" }), "Nova resposta r\u00E1pida"] })] })] }), _jsx(Dialog, { open: dialogOpen, onOpenChange: (value) => {
                    setDialogOpen(value);
                    if (!value) {
                        setForm({ label: '', text: '' });
                    }
                }, children: _jsxs(DialogContent, { className: "max-w-md rounded-2xl border border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-bold)] text-[color:var(--color-inbox-foreground)] shadow-[var(--shadow-lg)]", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: "Nova resposta r\u00E1pida" }), _jsx(DialogDescription, { children: "Crie atalhos para mensagens que voc\u00EA usa com frequ\u00EAncia e ganhe velocidade no atendimento." })] }), _jsxs("form", { onSubmit: handleCreate, className: "space-y-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "quick-reply-label", className: "text-xs font-semibold uppercase tracking-wide text-[color:var(--color-inbox-foreground-muted)]", children: "Nome vis\u00EDvel" }), _jsx(Input, { id: "quick-reply-label", value: form.label, onChange: (event) => setForm((current) => ({ ...current, label: event.target.value })), placeholder: "Ex.: Sauda\u00E7\u00E3o inicial", className: "h-10 rounded-lg border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-bold)] text-sm text-[color:var(--color-inbox-foreground)] placeholder:text-[color:var(--color-inbox-foreground-muted)]" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "quick-reply-text", className: "text-xs font-semibold uppercase tracking-wide text-[color:var(--color-inbox-foreground-muted)]", children: "Mensagem" }), _jsx(Textarea, { id: "quick-reply-text", value: form.text, onChange: (event) => setForm((current) => ({ ...current, text: event.target.value })), placeholder: "Escreva a mensagem completa que ser\u00E1 inserida na conversa", className: "min-h-[120px] rounded-lg border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-bold)] text-sm text-[color:var(--color-inbox-foreground)] placeholder:text-[color:var(--color-inbox-foreground-muted)]" })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "ghost", className: "border border-[color:var(--color-inbox-border)] bg-transparent text-[color:var(--color-inbox-foreground-muted)] hover:bg-[color:var(--surface-overlay-inbox-quiet)]", onClick: () => setDialogOpen(false), children: "Cancelar" }), _jsx(Button, { type: "submit", disabled: isSubmitDisabled, className: "bg-sky-600 text-white hover:bg-sky-500", children: "Salvar resposta" })] })] })] }) })] }));
};
export default QuickReplyMenu;
