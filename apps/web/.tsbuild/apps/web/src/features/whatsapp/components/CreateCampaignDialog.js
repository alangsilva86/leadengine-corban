import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, } from '@/components/ui/dialog.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import CreateCampaignWizard, { STEP_SEQUENCE, TOTAL_STEPS } from './CreateCampaignWizard.jsx';
const resolveInstanceLabel = (instance) => {
    if (!instance) {
        return 'Instância WhatsApp';
    }
    const candidates = [instance.name, instance.displayName, instance.id];
    const label = candidates.find((value) => typeof value === 'string' && value.trim().length > 0);
    return label ? label.trim() : 'Instância WhatsApp';
};
const CreateCampaignDialog = ({ open, onOpenChange, agreement, instances, defaultInstanceId, onSubmit, }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeStepIndex, setActiveStepIndex] = useState(0);
    const [selectionSummary, setSelectionSummary] = useState({ instance: null, agreement: null, product: null, strategy: null });
    useEffect(() => {
        if (!open) {
            setIsSubmitting(false);
            setActiveStepIndex(0);
            setSelectionSummary({ instance: null, agreement: null, product: null, strategy: null });
        }
    }, [open]);
    const handleSubmittingChange = useCallback((value) => {
        setIsSubmitting(Boolean(value));
    }, []);
    const handleDialogChange = useCallback((nextOpen) => {
        if (isSubmitting) {
            return;
        }
        onOpenChange?.(nextOpen);
    }, [isSubmitting, onOpenChange]);
    const handleSubmit = useCallback(async (payload) => {
        await onSubmit?.(payload);
        onOpenChange?.(false);
    }, [onSubmit, onOpenChange]);
    const handleCancel = useCallback(() => {
        if (isSubmitting) {
            return;
        }
        onOpenChange?.(false);
    }, [isSubmitting, onOpenChange]);
    const handleStepChange = useCallback((payload) => {
        if (!payload)
            return;
        setActiveStepIndex(payload.index ?? 0);
    }, []);
    const handleSelectionChange = useCallback((payload) => {
        if (!payload)
            return;
        setSelectionSummary(payload);
    }, []);
    const currentInstanceLabel = resolveInstanceLabel(selectionSummary.instance);
    const instanceStatusBadge = selectionSummary.instance
        ? selectionSummary.instance.connected
            ? { label: 'Conectada', tone: 'success' }
            : { label: 'Pendente', tone: 'warning' }
        : null;
    return (_jsx(Dialog, { open: open, onOpenChange: handleDialogChange, children: _jsxs(DialogContent, { className: "w-[95vw] min-h-0 rounded-2xl border border-border bg-background p-0 md:w-[85vw] md:max-w-[75vw] lg:max-w-[1200px]", children: [_jsxs(DialogHeader, { className: "border-b border-border/60 px-6 pb-4 pt-5", children: [_jsx(DialogTitle, { className: "text-lg font-semibold leading-6", children: "Nova campanha do WhatsApp" }), _jsx(DialogDescription, { className: "text-sm leading-5 text-muted-foreground", children: "Configure a campanha em cinco passos: inst\u00E2ncia conectada, origem, produto, estrat\u00E9gia e revis\u00E3o final." }), _jsxs("div", { className: "mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground", children: [_jsxs(Badge, { variant: "outline", className: "border-border/60 bg-muted/10 uppercase tracking-wide", children: ["Passo ", Math.min(activeStepIndex + 1, STEP_SEQUENCE.length), " de ", STEP_SEQUENCE.length] }), _jsxs("span", { children: ["Campanhas conectam Inst\u00E2ncias (Passo 1) \u00E0 Inbox (Passo ", TOTAL_STEPS, ")."] })] }), selectionSummary.instance ? (_jsxs("div", { className: "mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground", children: [_jsx("span", { className: "uppercase tracking-wide", children: "Inst\u00E2ncia ativa:" }), _jsx("span", { className: "text-sm font-semibold text-foreground", children: currentInstanceLabel }), instanceStatusBadge ? (_jsx(Badge, { variant: instanceStatusBadge.tone === 'success' ? 'secondary' : 'outline', className: instanceStatusBadge.tone === 'success'
                                        ? 'border-emerald-400/50 bg-emerald-500/10 text-emerald-200'
                                        : 'border-amber-400/60 bg-amber-500/10 text-amber-200', children: instanceStatusBadge.label })) : null] })) : null] }), _jsx(CreateCampaignWizard, { open: open, agreement: agreement, instances: instances, defaultInstanceId: defaultInstanceId, onSubmit: handleSubmit, onCancel: handleCancel, onSubmittingChange: handleSubmittingChange, onStepChange: handleStepChange, onSelectionChange: handleSelectionChange })] }) }));
};
export default CreateCampaignDialog;
