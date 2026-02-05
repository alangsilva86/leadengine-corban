import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '@/components/ui/select.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Label } from '@/components/ui/label.jsx';
const LossReasonDialog = ({ open, onOpenChange, options = [], onConfirm, isSubmitting = false, }) => {
    const [reason, setReason] = useState('');
    const [notes, setNotes] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const triggerRef = useRef(null);
    useEffect(() => {
        if (!open) {
            setReason('');
            setNotes('');
            setSubmitted(false);
            return;
        }
        const frame = requestAnimationFrame(() => {
            triggerRef.current?.focus();
        });
        return () => cancelAnimationFrame(frame);
    }, [open]);
    const handleConfirm = () => {
        setSubmitted(true);
        if (!reason) {
            return;
        }
        onConfirm?.({ reason, notes });
    };
    return (_jsx(Dialog, { open: open, onOpenChange: onOpenChange, children: _jsxs(DialogContent, { className: "sm:max-w-md", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: "Registrar perda" }), _jsx(DialogDescription, { children: "Informe o motivo da perda para manter o funil atualizado." })] }), _jsxs("div", { className: "space-y-4 py-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "loss-reason", children: "Motivo *" }), _jsxs(Select, { value: reason, onValueChange: (value) => {
                                        setReason(value);
                                        setSubmitted(false);
                                    }, children: [_jsx(SelectTrigger, { id: "loss-reason", className: "w-full min-h-[44px]", ref: triggerRef, children: _jsx(SelectValue, { placeholder: "Selecione" }) }), _jsx(SelectContent, { children: options.map((option) => (_jsx(SelectItem, { value: option.value, children: option.label }, option.value))) })] }), submitted && !reason ? (_jsx("p", { className: "text-xs text-rose-300", children: "Selecione um motivo para continuar." })) : null] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "loss-notes", children: "Observa\u00E7\u00F5es (opcional)" }), _jsx(Textarea, { id: "loss-notes", value: notes, onChange: (event) => setNotes(event.target.value), placeholder: "Detalhe o motivo ou pr\u00F3ximos passos." })] })] }), _jsxs(DialogFooter, { className: "gap-2", children: [_jsx(Button, { type: "button", variant: "outline", onClick: () => onOpenChange?.(false), className: "min-h-[44px]", children: "Cancelar" }), _jsx(Button, { type: "button", onClick: handleConfirm, disabled: isSubmitting, className: "min-h-[44px]", children: "Registrar perda" })] })] }) }));
};
export default LossReasonDialog;
