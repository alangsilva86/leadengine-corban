import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu.jsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import { ArrowLeftRight, Link as LinkIcon, Link2Off, Loader2, MoreVertical, PauseCircle, PlayCircle, Trash2 } from 'lucide-react';
import CampaignMetricsGrid from './CampaignMetricsGrid.jsx';
import { statusMeta } from '../utils/campaign-helpers.js';
import { findCampaignProduct, findCampaignStrategy } from '../utils/campaign-options.js';
import { formatAgreementLabel } from '../utils/campaign-formatters.js';
import { formatDateTime } from '../../chat/utils/datetime.js';
const parseMarginValue = (rawValue) => {
    if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
        return rawValue;
    }
    if (typeof rawValue === 'string' && rawValue.trim().length > 0) {
        const parsed = Number(rawValue);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
};
const resolveMetadata = (campaign) => campaign.metadata && typeof campaign.metadata === 'object' && !Array.isArray(campaign.metadata)
    ? campaign.metadata
    : {};
const resolveMargin = (campaign, metadata) => metadata.margin ??
    metadata.marginTarget ??
    metadata.marginPercentage ??
    metadata.marginPercent ??
    (typeof campaign.marginValue === 'number' ? campaign.marginValue : null) ??
    (typeof campaign.margin === 'number' ? campaign.margin : null);
const resolveInstanceLabel = (campaign) => {
    if (campaign.instanceId) {
        return campaign.instanceName || campaign.instanceId;
    }
    return 'Aguardando vínculo';
};
const CampaignCard = ({ campaign, isProcessing, onActivate, onDelete, onDisconnect, onPause, onReassign, selectedInstanceId, }) => {
    const statusInfo = statusMeta[campaign.status] ?? {
        label: campaign.status,
        variant: 'secondary',
    };
    const isLinked = Boolean(campaign.instanceId);
    const isEnded = campaign.status === 'ended';
    const highlight = campaign.instanceId && campaign.instanceId === (selectedInstanceId ?? null);
    const metadata = useMemo(() => resolveMetadata(campaign), [campaign]);
    const productValue = campaign.productType ??
        campaign.product ??
        metadata.product ??
        metadata.productKey ??
        metadata.productValue ??
        null;
    const strategyValue = metadata.strategy ?? metadata.strategyKey ?? campaign.strategy ?? null;
    const marginRaw = useMemo(() => resolveMargin(campaign, metadata), [campaign, metadata]);
    const productOption = useMemo(() => (productValue ? findCampaignProduct(productValue) : null), [productValue]);
    const strategyOption = useMemo(() => (strategyValue ? findCampaignStrategy(strategyValue) : null), [strategyValue]);
    const marginValue = useMemo(() => parseMarginValue(marginRaw), [marginRaw]);
    const agreementLabel = useMemo(() => formatAgreementLabel(campaign), [campaign]);
    const instanceLabel = useMemo(() => resolveInstanceLabel(campaign), [campaign]);
    const metrics = campaign.metrics ?? {};
    return (_jsxs("div", { className: "space-y-4 rounded-xl border border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] p-4", children: [_jsxs("div", { className: "flex flex-wrap items-start justify-between gap-3", children: [_jsxs("div", { className: "space-y-1.5", children: [_jsx("p", { className: "text-base font-bold text-foreground", children: campaign.name }), _jsxs("div", { className: "flex flex-wrap items-center gap-2 text-xs text-muted-foreground", children: [_jsxs("span", { children: ["ID: ", campaign.id] }), _jsx("span", { children: "\u2022" }), _jsx("span", { children: agreementLabel })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-2 text-[0.7rem] text-muted-foreground", children: [productOption ? _jsx(Badge, { variant: "outline", children: productOption.label }) : null, typeof marginValue === 'number' ? (_jsxs(Badge, { variant: "outline", children: ["Margem ", marginValue.toFixed(2), "%"] })) : null, strategyOption ? _jsx(Badge, { variant: "secondary", children: strategyOption.label }) : null] }), _jsx("div", { className: "flex items-center gap-1.5 text-xs", children: isLinked ? (_jsxs(_Fragment, { children: [_jsx(LinkIcon, { className: "h-3.5 w-3.5 text-success" }), _jsx("span", { className: "text-success font-medium", children: instanceLabel })] })) : (_jsxs(_Fragment, { children: [_jsx(Link2Off, { className: "h-3.5 w-3.5 text-muted-foreground" }), _jsx("span", { className: "text-muted-foreground", children: instanceLabel })] })) }), Array.isArray(campaign.tags) && campaign.tags.length > 0 ? (_jsx("div", { className: "flex flex-wrap items-center gap-1.5 pt-1", children: campaign.tags.map((tag) => (_jsx(Badge, { variant: "outline", className: "text-[10px] uppercase", children: tag }, `${campaign.id}-${tag}`))) })) : null] }), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [highlight ? _jsx(Badge, { variant: "info", children: "Inst\u00E2ncia selecionada" }) : null, _jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsx(Badge, { variant: "secondary", children: agreementLabel }) }), _jsx(TooltipContent, { children: "Origem comercial que identifica de onde v\u00EAm os leads desta campanha (conv\u00EAnio, parceiro ou carteira)." })] }), _jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsx(Badge, { variant: isLinked ? 'success' : 'outline', children: isLinked ? 'Instância vinculada' : 'Aguardando vínculo' }) }), _jsx(TooltipContent, { children: isLinked
                                            ? `Leads inbound serão direcionados para ${instanceLabel}.`
                                            : 'Associe uma instância conectada quando quiser distribuir leads automaticamente.' })] }), _jsx(Badge, { variant: statusInfo.variant, children: statusInfo.label })] })] }), _jsx(CampaignMetricsGrid, { metrics: [
                    { label: 'Leads recebidos', value: metrics.total },
                    { label: 'Contactados', value: metrics.contacted },
                    { label: 'Ganhos', value: metrics.won },
                    { label: 'Perdidos', value: metrics.lost },
                ] }), _jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground", children: [_jsxs("span", { children: ["Atualizada em ", formatDateTime(campaign.updatedAt)] }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [!isEnded && campaign.status !== 'active' ? (_jsxs(Button, { size: "sm", variant: "default", onClick: () => onActivate?.(campaign), disabled: isProcessing(campaign.id), children: [isProcessing(campaign.id, 'active') ? (_jsx(Loader2, { className: "mr-2 h-4 w-4 animate-spin" })) : (_jsx(PlayCircle, { className: "mr-2 h-4 w-4" })), "Ativar campanha"] })) : null, !isEnded && campaign.status === 'active' ? (_jsxs(Button, { size: "sm", variant: "outline", onClick: () => onPause?.(campaign), disabled: isProcessing(campaign.id), children: [isProcessing(campaign.id, 'paused') ? (_jsx(Loader2, { className: "mr-2 h-4 w-4 animate-spin" })) : (_jsx(PauseCircle, { className: "mr-2 h-4 w-4" })), "Pausar"] })) : null, !isEnded ? (_jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsxs(Button, { size: "sm", variant: "outline", disabled: isProcessing(campaign.id), children: [isProcessing(campaign.id) ? (_jsx(Loader2, { className: "mr-2 h-4 w-4 animate-spin" })) : (_jsx(MoreVertical, { className: "mr-2 h-4 w-4" })), "A\u00E7\u00F5es"] }) }), _jsxs(DropdownMenuContent, { align: "end", children: [_jsxs(DropdownMenuItem, { onClick: () => onReassign?.(campaign), disabled: isProcessing(campaign.id), children: [_jsx(ArrowLeftRight, { className: "mr-2 h-4 w-4" }), isLinked ? 'Reatribuir instância' : 'Vincular instância'] }), isLinked ? (_jsxs(DropdownMenuItem, { onClick: () => onDisconnect?.(campaign), disabled: isProcessing(campaign.id), children: [_jsx(Link2Off, { className: "mr-2 h-4 w-4" }), "Desvincular inst\u00E2ncia"] })) : null, _jsx(DropdownMenuSeparator, {}), _jsxs(DropdownMenuItem, { variant: "destructive", onClick: () => onDelete?.(campaign), disabled: isProcessing(campaign.id), children: [_jsx(Trash2, { className: "mr-2 h-4 w-4" }), "Encerrar campanha"] })] })] })) : null] })] })] }));
};
export default CampaignCard;
