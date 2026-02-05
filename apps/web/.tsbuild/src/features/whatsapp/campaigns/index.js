import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Suspense, lazy, useMemo } from 'react';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card } from '@/components/ui/card.jsx';
import NoticeBanner from '@/components/ui/notice-banner.jsx';
import { Separator } from '@/components/ui/separator.jsx';
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils.js';
import { toast } from 'sonner';
import useWhatsAppConnect from '../connect/useWhatsAppConnect';
const CampaignsPanel = lazy(() => import('../components/CampaignsPanel.jsx'));
const CreateCampaignDialog = lazy(() => import('../components/CreateCampaignDialog.jsx'));
const ReassignCampaignDialog = lazy(() => import('../components/ReassignCampaignDialog.jsx'));
const SectionFallback = () => (_jsx(Card, { className: "border border-border/60 bg-surface-overlay-quiet p-6 text-sm text-muted-foreground", children: "Carregando\u2026" }));
const DialogFallback = () => null;
const WhatsAppCampaigns = (props) => {
    const { statusCopy, statusTone, confirmLabel, confirmDisabled, onBack, onContinue, campaigns, campaignsLoading, campaignError, campaignAction, reloadCampaigns, updateCampaignStatus, deleteCampaign, reassignCampaign, canCreateCampaigns, selectedAgreement, selectedInstance, setCreateCampaignOpen, isCreateCampaignOpen, createCampaign, renderInstances, setPendingReassign, pendingReassign, setReassignIntent, reassignIntent, fetchCampaignImpact, agreementName, persistentWarning, nextStage, stepLabel, onboardingDescription, realtimeConnected, connectionStatus, connectionHealthy, tenantFilterId, tenantFilterLabel, tenantScopeNotice, selectedInstanceBelongsToTenant, } = useWhatsAppConnect(props);
    const backLabel = 'Voltar';
    const fallbackSteps = useMemo(() => [
        { id: 'channels', label: 'Instâncias & Canais' },
        { id: 'campaigns', label: 'Campanhas' },
        { id: 'inbox', label: 'Inbox' },
    ], []);
    const resolvedSteps = props?.onboarding?.stages?.length
        ? props.onboarding.stages
        : fallbackSteps;
    const activeStepIndex = props?.onboarding?.activeStep ?? 1;
    const currentStage = resolvedSteps[activeStepIndex] ?? resolvedSteps[1] ?? resolvedSteps[0];
    const stageObjectives = {
        channels: 'Conecte instância',
        campaigns: 'Configure campanha',
        inbox: 'Revise roteamento',
    };
    const objectiveCopy = stageObjectives[currentStage?.id ?? ''] ?? 'Avance na jornada de integração';
    const supportCopy = `${objectiveCopy}. ${onboardingDescription}`;
    const tenantDisplayName = tenantFilterLabel ?? tenantFilterId ?? null;
    const hasCampaigns = (campaigns?.length ?? 0) > 0;
    const primaryAction = hasCampaigns ? 'continue' : 'create';
    const primaryLabel = hasCampaigns ? confirmLabel ?? 'Continuar' : 'Criar campanha';
    const isPrimaryDisabled = hasCampaigns ? confirmDisabled || !connectionHealthy : !connectionHealthy;
    const connectionBlockedMessage = connectionHealthy
        ? null
        : realtimeConnected
            ? 'Conecte uma instância ativa e com tempo real para gerenciar as campanhas.'
            : 'Tempo real está offline. Reative a conexão para gerenciar as campanhas.';
    const tenantWarningMessage = tenantFilterId && !selectedInstanceBelongsToTenant
        ? 'A instância ativa não pertence ao tenant selecionado; escolha uma instância compatível.'
        : tenantScopeNotice ?? null;
    const realtimeWarningMessage = connectionHealthy && !realtimeConnected
        ? 'Tempo real está offline. Você ainda pode criar ou ajustar campanhas, mas métricas instantâneas ficarão indisponíveis até restabelecer a conexão.'
        : null;
    const statusBadgeTone = statusTone;
    const statusBadgeLabel = statusCopy.badge;
    const handlePrimaryAction = () => {
        if (primaryAction === 'create') {
            if (!canCreateCampaigns) {
                toast.error('Conecte uma instância ativa para criar campanhas de WhatsApp.');
                return;
            }
            setCreateCampaignOpen(true);
            return;
        }
        onContinue?.();
    };
    const handleStageNavigate = (stageId, index) => {
        if (props?.onNavigateStage) {
            props.onNavigateStage(stageId);
            return;
        }
        if (index < activeStepIndex) {
            onBack?.();
            return;
        }
        if (index > activeStepIndex) {
            onContinue?.();
        }
    };
    return (_jsxs("div", { className: "mx-auto max-w-5xl space-y-6", children: [_jsxs("header", { className: "space-y-4 rounded-[var(--radius)] border border-[var(--border)] bg-surface-overlay-strong px-6 py-5 shadow-sm", children: [_jsxs("div", { className: "flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between", children: [_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground", children: [_jsx(Badge, { variant: "secondary", children: stepLabel }), _jsx("span", { className: "font-semibold text-foreground/80", children: objectiveCopy }), nextStage ? _jsxs("span", { className: "text-[color:var(--color-inbox-foreground-muted)]", children: ["Pr\u00F3ximo: ", nextStage] }) : null] }), _jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-semibold text-foreground", children: "Gerencie suas campanhas" }), _jsx("p", { className: "max-w-2xl text-sm text-muted-foreground", children: supportCopy })] })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [selectedInstance ? (_jsxs(Badge, { variant: "outline", className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200", children: ["Inst\u00E2ncia ativa \u00B7 ", selectedInstance.name ?? selectedInstance.id] })) : null, tenantDisplayName ? (_jsxs(Badge, { variant: "outline", className: "border-primary/40 bg-primary/10 text-primary", children: ["Tenant \u00B7 ", tenantDisplayName] })) : null, _jsx(Badge, { variant: "status", tone: statusBadgeTone, className: "gap-2 text-xs font-medium uppercase", children: statusBadgeLabel })] })] }), _jsx(Separator, { className: "section-divider" }), _jsxs("div", { className: "flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between", children: [_jsx("div", { className: "flex flex-wrap gap-2 text-sm", children: resolvedSteps.map((step, index) => {
                                    const status = index < activeStepIndex ? 'done' : index === activeStepIndex ? 'current' : 'todo';
                                    return (_jsxs("button", { type: "button", onClick: () => handleStageNavigate(step.id, index), className: cn('group inline-flex items-center gap-2 rounded-full border px-3 py-1.5 transition', 'hover:border-primary/50 hover:text-primary', status === 'done' && 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700', status === 'current' && 'border-primary/50 bg-primary/15 text-primary', status === 'todo' && 'border-border/70 text-muted-foreground'), children: [_jsx("span", { className: cn('inline-flex h-6 w-6 items-center justify-center rounded-full border text-[0.7rem] font-semibold transition', status === 'done' && 'border-emerald-500/60 bg-emerald-500/15 text-emerald-700', status === 'current' && 'border-primary/60 bg-primary/20 text-primary', status === 'todo' && 'border-border/60 bg-background text-muted-foreground'), children: status === 'done' ? _jsx(Check, { className: "h-3.5 w-3.5" }) : index + 1 }), _jsx("span", { className: "text-sm font-medium leading-none", children: step.label })] }, step.id));
                                }) }), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [onBack ? (_jsxs(Button, { variant: "ghost", size: "sm", onClick: onBack, children: [_jsx(ArrowLeft, { className: "mr-2 h-4 w-4" }), backLabel] })) : null, _jsxs(Button, { size: "sm", onClick: handlePrimaryAction, disabled: isPrimaryDisabled, children: [isPrimaryDisabled && primaryAction === 'continue' ? (_jsx(Loader2, { className: "mr-2 h-4 w-4 animate-spin" })) : (_jsx(CheckCircle2, { className: "mr-2 h-4 w-4" })), primaryLabel] })] })] })] }), tenantWarningMessage ? (_jsx(NoticeBanner, { tone: "warning", icon: _jsx(AlertTriangle, { className: "h-4 w-4" }), children: tenantWarningMessage })) : null, connectionBlockedMessage ? (_jsx(NoticeBanner, { tone: "warning", icon: _jsx(AlertTriangle, { className: "h-4 w-4" }), children: connectionBlockedMessage })) : null, realtimeWarningMessage ? (_jsx(NoticeBanner, { tone: "warning", icon: _jsx(AlertTriangle, { className: "h-4 w-4" }), children: realtimeWarningMessage })) : null, persistentWarning ? (_jsxs(NoticeBanner, { tone: "warning", icon: _jsx(AlertTriangle, { className: "h-4 w-4" }), children: [_jsx("p", { children: persistentWarning }), _jsx("p", { className: "text-xs text-amber-200/80", children: "Os leads continuam chegando normalmente; campanhas ajudam apenas no roteamento avan\u00E7ado e podem ser criadas quando achar necess\u00E1rio." })] })) : null, _jsx(Suspense, { fallback: _jsx(SectionFallback, {}), children: _jsx(CampaignsPanel, { agreementName: agreementName ?? undefined, campaigns: campaigns, loading: campaignsLoading, error: campaignError, onRefresh: () => void reloadCampaigns(), onCreateClick: () => setCreateCampaignOpen(true), onPause: (target) => void updateCampaignStatus(target, 'paused'), onActivate: (target) => void updateCampaignStatus(target, 'active'), onDelete: (target) => void deleteCampaign(target), onReassign: (target) => {
                        setPendingReassign(target);
                        setReassignIntent('reassign');
                    }, onDisconnect: (target) => {
                        setPendingReassign(target);
                        setReassignIntent('disconnect');
                    }, actionState: campaignAction, selectedInstanceId: selectedInstance?.id ?? null, canCreateCampaigns: canCreateCampaigns, selectedAgreementId: selectedAgreement?.id ?? null }) }), _jsx(Suspense, { fallback: _jsx(DialogFallback, {}), children: _jsx(CreateCampaignDialog, { open: isCreateCampaignOpen, onOpenChange: setCreateCampaignOpen, agreement: selectedAgreement, instances: renderInstances, defaultInstanceId: selectedInstance?.id ?? undefined, onSubmit: createCampaign }) }), _jsx(Suspense, { fallback: _jsx(DialogFallback, {}), children: _jsx(ReassignCampaignDialog, { open: Boolean(pendingReassign), onClose: (value) => {
                        if (!value) {
                            setPendingReassign(null);
                        }
                    }, campaign: pendingReassign, instances: renderInstances, fetchImpact: fetchCampaignImpact, intent: reassignIntent, onSubmit: async ({ instanceId }) => {
                        if (!pendingReassign) {
                            return;
                        }
                        const targetInstance = reassignIntent === 'disconnect' ? null : instanceId ?? null;
                        await reassignCampaign(pendingReassign, targetInstance);
                        setPendingReassign(null);
                    } }) })] }));
};
export default WhatsAppCampaigns;
