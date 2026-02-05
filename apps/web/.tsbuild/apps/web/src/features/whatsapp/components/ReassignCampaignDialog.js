import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '@/components/ui/select.jsx';
import NoticeBanner from '@/components/ui/notice-banner.jsx';
import { AlertCircle } from 'lucide-react';
import { Label } from '@/components/ui/label.jsx';
import CampaignMetricsGrid from './CampaignMetricsGrid.jsx';
import { statusMeta } from '../utils/campaign-helpers.js';
const DISCONNECT_VALUE = '__disconnect__';
const ReassignCampaignDialog = ({ open, campaign, instances, onClose, onSubmit, fetchImpact, intent = 'reassign', }) => {
    const [selectedInstanceId, setSelectedInstanceId] = useState(DISCONNECT_VALUE);
    const [error, setError] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [impactSummary, setImpactSummary] = useState(null);
    const [impactLoading, setImpactLoading] = useState(false);
    const [impactError, setImpactError] = useState(null);
    const sortedInstances = useMemo(() => {
        return [...(instances || [])].sort((a, b) => {
            const labelA = a.name || a.id;
            const labelB = b.name || b.id;
            return labelA.localeCompare(labelB);
        });
    }, [instances]);
    useEffect(() => {
        if (!open) {
            return;
        }
        const baseSelection = campaign?.instanceId && campaign.instanceId.trim().length > 0
            ? campaign.instanceId
            : DISCONNECT_VALUE;
        setSelectedInstanceId(intent === 'disconnect' ? DISCONNECT_VALUE : baseSelection);
        setError(null);
        setSubmitting(false);
        setImpactSummary(null);
        setImpactError(null);
        if (!campaign?.id || typeof fetchImpact !== 'function') {
            return;
        }
        setImpactLoading(true);
        fetchImpact(campaign.id)
            .then((data) => {
            setImpactSummary(data?.summary ?? null);
        })
            .catch((err) => {
            const message = err instanceof Error ? err.message : 'Não foi possível carregar o impacto.';
            setImpactError(message);
        })
            .finally(() => {
            setImpactLoading(false);
        });
    }, [campaign?.id, campaign?.instanceId, fetchImpact, intent, open]);
    const normalizedSelection = selectedInstanceId === DISCONNECT_VALUE ? null : selectedInstanceId;
    const currentInstance = campaign?.instanceId ?? null;
    const hasChanged = (normalizedSelection ?? null) !== (currentInstance ?? null);
    const canSubmit = hasChanged && !submitting;
    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!canSubmit) {
            setError('Selecione uma instância diferente ou escolha desvincular a campanha.');
            return;
        }
        setSubmitting(true);
        setError(null);
        try {
            await onSubmit?.({ instanceId: normalizedSelection });
            onClose?.(false);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Não foi possível reatribuir a campanha.';
            setError(message);
        }
        finally {
            setSubmitting(false);
        }
    };
    const statusInfo = statusMeta[campaign?.status] ?? { label: campaign?.status ?? '—', variant: 'secondary' };
    const agreementLabel = campaign?.agreementName || campaign?.agreementId || '—';
    const currentInstanceLabel = campaign?.instanceName || campaign?.instanceId || 'Sem instância vinculada';
    return (_jsx(Dialog, { open: open, onOpenChange: (value) => (!submitting ? onClose?.(value) : null), children: _jsxs(DialogContent, { className: "max-w-2xl", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: "Atualizar v\u00EDnculo da campanha" }), _jsx(DialogDescription, { children: "Escolha qualquer inst\u00E2ncia conectada ou deixe a campanha aguardando v\u00EDnculo para pausar temporariamente o roteamento autom\u00E1tico." })] }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-5", children: [_jsxs("div", { className: "rounded-lg border border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] p-4", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold text-foreground", children: campaign?.name }), _jsxs("p", { className: "text-xs text-muted-foreground", children: ["ID: ", campaign?.id] })] }), _jsx(Badge, { variant: statusInfo.variant, children: statusInfo.label })] }), _jsxs("p", { className: "mt-3 text-xs text-muted-foreground", children: ["Conv\u00EAnio: ", agreementLabel] }), _jsxs("p", { className: "text-xs text-muted-foreground", children: ["Inst\u00E2ncia atual: ", currentInstanceLabel] })] }), _jsx(NoticeBanner, { tone: "warning", icon: _jsx(AlertCircle, { className: "h-4 w-4" }), children: _jsx("p", { children: "Revise o impacto antes de confirmar. Ao desvincular, novos leads ficar\u00E3o aguardando v\u00EDnculo; ao reatribuir, eles ser\u00E3o direcionados imediatamente para a inst\u00E2ncia escolhida." }) }), _jsx(CampaignMetricsGrid, { loading: impactLoading, metrics: impactSummary
                                ? [
                                    { label: 'Leads totais', value: impactSummary.total },
                                    { label: 'Contactados', value: impactSummary.contacted },
                                    { label: 'Ganhos', value: impactSummary.won },
                                    { label: 'Perdidos', value: impactSummary.lost },
                                ]
                                : [], fallback: impactError
                                ? impactError
                                : 'Nenhum lead alocado foi encontrado para essa campanha até o momento.' }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Nova inst\u00E2ncia" }), _jsxs(Select, { value: selectedInstanceId, onValueChange: (value) => {
                                        setSelectedInstanceId(value);
                                        setError(null);
                                    }, disabled: submitting, children: [_jsx(SelectTrigger, { children: _jsx(SelectValue, { placeholder: "Selecione a inst\u00E2ncia" }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: DISCONNECT_VALUE, children: "Sem inst\u00E2ncia (aguardando v\u00EDnculo)" }), sortedInstances.map((entry) => (_jsx(SelectItem, { value: entry.id, children: entry.name || entry.id }, entry.id)))] })] }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Selecione uma inst\u00E2ncia conectada ou escolha \"Sem inst\u00E2ncia\" para deixar a campanha aguardando v\u00EDnculo." })] }), error ? (_jsxs("div", { className: "flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive", children: [_jsx(AlertCircle, { className: "h-4 w-4" }), _jsx("span", { children: error })] })) : null, _jsxs(DialogFooter, { className: "mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", children: [_jsx(Button, { type: "button", variant: "ghost", disabled: submitting, onClick: () => onClose?.(false), children: "Cancelar" }), _jsx(Button, { type: "submit", disabled: !canSubmit, children: submitting ? 'Salvando…' : 'Aplicar alterações' })] })] })] }) }));
};
export default ReassignCampaignDialog;
