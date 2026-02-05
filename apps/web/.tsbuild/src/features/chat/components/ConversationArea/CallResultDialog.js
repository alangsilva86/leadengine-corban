import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '@/components/ui/dialog.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '@/components/ui/select.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Button } from '@/components/ui/button.jsx';
const DEFAULT_OUTCOME = 'connected';
const CallResultDialog = ({ open, onOpenChange, onSubmit }) => {
    const [outcome, setOutcome] = useState(DEFAULT_OUTCOME);
    const [notes, setNotes] = useState('');
    const triggerRef = useRef(null);
    useEffect(() => {
        if (!open) {
            setOutcome(DEFAULT_OUTCOME);
            setNotes('');
            return;
        }
        const frame = requestAnimationFrame(() => {
            triggerRef.current?.focus();
        });
        return () => cancelAnimationFrame(frame);
    }, [open]);
    const handleSubmit = () => {
        onSubmit?.({ outcome, notes });
    };
    return (_jsx(Dialog, { open: open, onOpenChange: onOpenChange, children: _jsxs(DialogContent, { className: "sm:max-w-sm", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: "Registrar resultado da chamada" }), _jsx(DialogDescription, { children: "Informe o status e anote qualquer observa\u00E7\u00E3o relevante antes de voltar para o chat." })] }), _jsxs("div", { className: "space-y-3", children: [_jsx(Label, { htmlFor: "call-outcome", className: "text-sm font-medium text-foreground", children: "Resultado" }), _jsxs(Select, { value: outcome, onValueChange: setOutcome, children: [_jsx(SelectTrigger, { id: "call-outcome", className: "h-10", ref: triggerRef, children: _jsx(SelectValue, {}) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "connected", children: "Conectou" }), _jsx(SelectItem, { value: "no_answer", children: "Sem resposta" }), _jsx(SelectItem, { value: "voicemail", children: "Caixa postal" })] })] }), _jsx(Label, { htmlFor: "call-notes", className: "text-sm font-medium text-foreground", children: "Observa\u00E7\u00F5es" }), _jsx(Textarea, { id: "call-notes", value: notes, onChange: (event) => setNotes(event.target.value), placeholder: "Resumo do contato", className: "min-h-[100px]" })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: () => onOpenChange?.(false), children: "Cancelar" }), _jsx(Button, { type: "button", onClick: handleSubmit, children: "Registrar" })] })] }) }));
};
export default CallResultDialog;
