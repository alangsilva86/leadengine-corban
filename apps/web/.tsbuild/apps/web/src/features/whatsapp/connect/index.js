import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card } from '@/components/ui/card.jsx';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx';
import { Separator } from '@/components/ui/separator.jsx';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible.jsx';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from '@/components/ui/alert-dialog.jsx';
import { AlertCircle, ArrowLeft, Check, ChevronDown, Clock, Loader2, QrCode, MessageSquare, Plus, Server, Shield, } from 'lucide-react';
import useWhatsAppConnect from './useWhatsAppConnect';
const InstancesPanel = lazy(() => import('../components/InstancesPanel.jsx'));
const CreateInstanceDialog = lazy(() => import('../components/CreateInstanceDialog.jsx'));
const QrPreview = lazy(() => import('../components/QrPreview'));
const AdvancedOperationsPanel = lazy(() => import('../components/AdvancedOperationsPanel.jsx'));
const SectionFallback = () => (_jsx(Card, { className: "border border-border/60 bg-surface-overlay-quiet p-6 text-sm text-muted-foreground", children: "Carregando\u2026" }));
const DialogFallback = () => null;
const wizardSteps = [
    {
        id: 1,
        title: 'Criar nova instância',
        description: 'Abra uma nova instância antes de prosseguir com o pareamento.',
        Icon: Server,
    },
    {
        id: 2,
        title: 'Ler QR Code',
        description: 'Escaneie o código no WhatsApp oficial para conectar.',
        Icon: QrCode,
    },
    {
        id: 3,
        title: 'Validar canal',
        description: 'Envie uma mensagem de teste e confirme o retorno.',
        Icon: MessageSquare,
    },
];
const WhatsAppConnect = (props) => {
    const { surfaceStyles, statusCopy, statusTone, countdownMessage, qrImageSrc, isGeneratingQrImage, qrStatusMessage, hasAgreement, agreementDisplayName, selectedAgreement, selectedInstance, selectedInstancePhone, selectedInstanceStatusInfo, instancesReady, hasHiddenInstances, hasRenderableInstances, instanceViewModels, showFilterNotice, instancesCountLabel, loadingInstances, isAuthenticated, copy, localStatus, onBack, handleRefreshInstances, handleCreateInstance, submitCreateInstance, campaign, setShowAllInstances, setQrPanelOpen, setQrDialogOpen, pairingPhoneInput, pairingPhoneError, requestingPairingCode, handlePairingPhoneChange, handleRequestPairingCode, timelineItems, realtimeConnected, handleInstanceSelect, handleViewQr, handleGenerateQr, handleMarkConnected, handleDeleteInstance, deletionDialog, setInstancePendingDelete, isBusy, canContinue, qrPanelOpen, isQrDialogOpen, hasCampaign, statusCodeMeta, defaultInstanceName, deletingInstanceId, errorState, loadInstances, showAllInstances, handleRetry, setCreateInstanceOpen, isCreateInstanceOpen, nextStage, stepLabel, onboardingDescription, canCreateCampaigns, canCreateInstance, createInstanceWarning, } = useWhatsAppConnect(props);
    const currentInstance = selectedInstance ?? null;
    const instanceHealth = useMemo(() => {
        const totals = { connected: 0, connecting: 0, needsAttention: 0, offline: 0 };
        if (!instancesReady) {
            return { state: 'loading', total: instanceViewModels.length, totals };
        }
        instanceViewModels.forEach((viewModel) => {
            const variant = viewModel.statusInfo?.variant;
            switch (variant) {
                case 'success':
                    totals.connected += 1;
                    break;
                case 'info':
                    totals.connecting += 1;
                    break;
                case 'warning':
                case 'destructive':
                    totals.needsAttention += 1;
                    break;
                default:
                    totals.offline += 1;
                    break;
            }
        });
        const total = instanceViewModels.length;
        return {
            state: total === 0 ? 'empty' : 'ready',
            total,
            totals,
        };
    }, [instanceViewModels, instancesReady]);
    const [wizardState, setWizardState] = useState(() => ({
        mode: null,
        agentInstalled: localStatus === 'connecting' || localStatus === 'connected',
        qrConfirmed: localStatus === 'connected',
        validationDone: localStatus === 'connected',
    }));
    useEffect(() => {
        setWizardState((prev) => ({
            ...prev,
            agentInstalled: prev.agentInstalled || localStatus === 'connecting' || localStatus === 'connected',
            qrConfirmed: localStatus === 'connected',
            validationDone: prev.validationDone || localStatus === 'connected',
        }));
    }, [localStatus]);
    const [showInstanceManager, setShowInstanceManager] = useState(!selectedInstance);
    useEffect(() => {
        if (!selectedInstance) {
            setShowInstanceManager(true);
        }
    }, [selectedInstance]);
    const assistantRef = useRef(null);
    const scrollToAssistant = () => assistantRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const updateWizardState = (patch) => {
        setWizardState((prev) => ({ ...prev, ...patch }));
    };
    const hasInstanceReady = Boolean(selectedInstance || instanceViewModels.length > 0);
    const getStepState = useCallback((stepId) => {
        if (stepId === 1) {
            return hasInstanceReady ? 'done' : 'active';
        }
        if (stepId === 2) {
            return wizardState.qrConfirmed ? 'done' : hasInstanceReady ? 'active' : 'blocked';
        }
        if (stepId === 3) {
            return wizardState.validationDone ? 'done' : wizardState.qrConfirmed ? 'active' : 'blocked';
        }
        return 'active';
    }, [hasInstanceReady, wizardState.qrConfirmed, wizardState.validationDone]);
    const [openSteps, setOpenSteps] = useState(() => wizardSteps.reduce((acc, step) => {
        const state = getStepState(step.id);
        acc[step.id] = state === 'active' || state === 'done';
        return acc;
    }, {}));
    useEffect(() => {
        setOpenSteps((prev) => {
            let changed = false;
            const next = { ...prev };
            wizardSteps.forEach((step) => {
                const state = getStepState(step.id);
                if (state === 'active' && !prev[step.id]) {
                    next[step.id] = true;
                    changed = true;
                    return;
                }
                if (prev[step.id] === undefined) {
                    next[step.id] = state !== 'blocked';
                    changed = true;
                }
            });
            return changed ? next : prev;
        });
    }, [getStepState]);
    const checklistItems = useMemo(() => {
        const qrReady = wizardState.qrConfirmed;
        const validationReady = wizardState.validationDone || localStatus === 'connected';
        return [
            {
                id: 'instance',
                title: 'Nova instância',
                description: 'Crie ou selecione um canal antes de continuar.',
                state: hasInstanceReady ? 'done' : 'in_progress',
                actionLabel: hasInstanceReady ? 'Instância pronta' : 'Nova instância',
            },
            {
                id: 'qr',
                title: 'Ler QR Code oficial',
                description: 'Gere o QR e escaneie pelo WhatsApp.',
                state: qrReady ? 'done' : hasInstanceReady ? 'in_progress' : 'pending',
                actionLabel: qrReady ? 'Conectado' : 'Gerar QR',
            },
            {
                id: 'events',
                title: 'Validar canal',
                description: 'Envie uma mensagem de teste e confirme a volta.',
                state: qrReady ? (validationReady ? 'done' : 'in_progress') : 'pending',
                actionLabel: validationReady ? 'Validado' : 'Testar agora',
            },
        ];
    }, [
        hasInstanceReady,
        localStatus,
        wizardState.qrConfirmed,
        wizardState.validationDone,
    ]);
    const metricsAvailable = localStatus === 'connected';
    const timelinePreview = timelineItems.slice(0, 4);
    const instanceRecord = currentInstance?.instance && typeof currentInstance.instance === 'object'
        ? currentInstance.instance
        : null;
    const planLabel = (typeof instanceRecord?.plan === 'string' && instanceRecord.plan) ||
        (typeof instanceRecord?.tier === 'string' && instanceRecord.tier) ||
        'Plano padrão';
    const rawMetrics = instanceRecord &&
        typeof instanceRecord.metrics === 'object' &&
        !Array.isArray(instanceRecord.metrics)
        ? (instanceRecord.metrics ?? null)
        : null;
    const uptimeLabel = (rawMetrics && typeof rawMetrics['uptime'] === 'string' && rawMetrics['uptime']) || '99,9%';
    const latencyLabel = (rawMetrics && typeof rawMetrics['latency'] === 'string' && rawMetrics['latency']) ||
        (rawMetrics && typeof rawMetrics['latency'] === 'number' && `${rawMetrics['latency']}ms`) ||
        '320ms';
    const rateUsage = currentInstance?.rateUsage ?? currentInstance?.metrics?.rateUsage ?? null;
    const usageLabel = rateUsage
        ? `${rateUsage.used ?? 0}/${rateUsage.limit ?? 0} msgs hoje`
        : `${Math.round(currentInstance?.ratePercentage ?? 0)}% do limite`;
    const numberLabel = selectedInstancePhone || currentInstance?.phoneLabel || 'Sem número definido';
    const instanceName = currentInstance?.displayName ?? defaultInstanceName;
    const modeLabel = wizardState.mode === 'number' ? 'Instância por número' : 'Instância por sessão';
    const backLabel = 'Voltar';
    return (_jsxs("div", { className: "mx-auto max-w-6xl space-y-6", children: [_jsxs("header", { className: "glass-surface space-y-6 rounded-[var(--radius)] border border-[var(--border)] px-6 py-5 shadow-sm", children: [_jsxs("div", { className: "flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between", children: [_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-[color:var(--color-inbox-foreground-muted)]/80", children: [_jsx(Badge, { variant: "secondary", children: stepLabel }), nextStage ? _jsxs("span", { children: ["Pr\u00F3ximo: ", nextStage] }) : null] }), _jsxs("div", { className: "space-y-2", children: [_jsxs("h1", { className: "text-2xl font-semibold text-foreground", children: ["Inst\u00E2ncia WhatsApp \u00B7 ", instanceName] }), _jsx("p", { className: "max-w-2xl text-sm text-muted-foreground", children: onboardingDescription })] }), onBack ? (_jsxs(Button, { variant: "ghost", size: "sm", onClick: onBack, className: "w-fit", children: [_jsx(ArrowLeft, { className: "mr-2 h-4 w-4" }), backLabel] })) : null] }), _jsxs("div", { className: "flex flex-col gap-3 text-xs text-muted-foreground", children: [_jsx(Badge, { variant: "status", tone: statusTone, className: "gap-2 text-xs font-medium uppercase", children: statusCopy.badge }), _jsxs("div", { className: "flex flex-wrap items-center justify-end gap-2 text-[0.7rem]", children: [instanceHealth.state === 'loading' ? (_jsx(Badge, { variant: "status", tone: "info", children: "Sincronizando inst\u00E2ncias\u2026" })) : instanceHealth.state === 'empty' ? (_jsx(Badge, { variant: "status", tone: "info", children: "Nenhuma inst\u00E2ncia conectada" })) : (_jsxs(_Fragment, { children: [_jsxs(Badge, { variant: "status", tone: "success", children: [instanceHealth.totals.connected, " conectada(s)"] }), instanceHealth.totals.connecting ? (_jsxs(Badge, { variant: "status", tone: "info", children: [instanceHealth.totals.connecting, " sincronizando"] })) : null, instanceHealth.totals.needsAttention ? (_jsxs(Badge, { variant: "status", tone: "warning", children: [instanceHealth.totals.needsAttention, " requer(em) a\u00E7\u00E3o"] })) : null, instanceHealth.totals.offline ? (_jsxs(Badge, { variant: "status", tone: "neutral", children: [instanceHealth.totals.offline, " offline"] })) : null] })), _jsx("span", { className: "text-[0.65rem] uppercase tracking-wide text-muted-foreground/80", children: instancesCountLabel })] }), countdownMessage ? (_jsxs("span", { className: "flex items-center gap-1 text-amber-200", role: "status", "aria-live": "polite", children: [_jsx(Clock, { className: "h-3.5 w-3.5" }), countdownMessage] })) : null] })] }), _jsx(Separator, { className: "section-divider" }), _jsxs("div", { className: "flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2 text-xs text-muted-foreground", children: [_jsxs(Badge, { variant: "outline", className: "border-indigo-400/60 text-indigo-100", children: ["Plano: ", planLabel] }), _jsxs(Badge, { variant: "outline", className: "border-slate-500/60 text-slate-100", children: ["Limite di\u00E1rio: ", rateUsage?.limit ? `${rateUsage.limit} msgs` : 'Automático'] }), _jsx(Badge, { variant: "outline", className: "border-emerald-500/60 text-emerald-100", children: usageLabel })] }), _jsxs("div", { className: "flex flex-col gap-1 text-right", children: [_jsx("span", { className: "text-xs uppercase tracking-wide text-muted-foreground", children: "Modo atual" }), _jsx(Badge, { variant: "secondary", children: "Inst\u00E2ncia por n\u00FAmero" }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Modo \u00FAnico e liberado para todos os usu\u00E1rios da conta." })] }), _jsxs("div", { className: "flex flex-col gap-2", children: [_jsx(Button, { onClick: scrollToAssistant, className: "justify-center", children: "Iniciar conex\u00E3o" }), _jsx("p", { className: "text-[0.7rem] text-muted-foreground", children: "Este bot\u00E3o leva voc\u00EA diretamente ao Assistente de Conex\u00E3o." })] })] })] }), _jsxs("div", { className: "grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]", children: [_jsx("div", { className: "space-y-6", children: _jsxs("section", { ref: assistantRef, id: "assistente-de-conexao", className: "glass-surface space-y-6 rounded-[var(--radius)] border border-border/60 px-5 py-6 shadow-sm", children: [_jsxs("div", { className: "flex flex-col gap-2", children: [_jsx("span", { className: "text-xs uppercase tracking-wide text-muted-foreground", children: "Assistente de conex\u00E3o" }), _jsx("h2", { className: "text-lg font-semibold text-white", children: "Configure sua inst\u00E2ncia" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Complete cada subetapa em ordem. Recursos avan\u00E7ados s\u00F3 s\u00E3o exibidos ap\u00F3s a conex\u00E3o." })] }), _jsx("div", { className: "grid gap-4", children: wizardSteps.map((step) => {
                                        const stepState = getStepState(step.id);
                                        const isBlocked = (step.id === 2 && !hasInstanceReady) || (step.id === 3 && !wizardState.qrConfirmed);
                                        const stateClasses = stepState === 'done'
                                            ? 'border-emerald-500/60'
                                            : stepState === 'active'
                                                ? 'border-primary/40'
                                                : 'border-border/60';
                                        const isOpen = openSteps[step.id] ?? true;
                                        return (_jsxs(Collapsible, { open: isOpen, onOpenChange: (open) => setOpenSteps((prev) => ({ ...prev, [step.id]: open })), className: `rounded-[calc(var(--radius)_-_2px)] border px-4 py-4 transition ${stateClasses} ${isBlocked ? 'opacity-60' : ''}`, children: [_jsxs(CollapsibleTrigger, { className: "flex w-full items-start gap-3 text-left", children: [_jsx("div", { className: "rounded-full border border-border/60 bg-surface-overlay-quiet px-3 py-1 text-xs font-semibold", children: step.id }), _jsxs("div", { className: "flex-1 space-y-1", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(step.Icon, { className: "h-4 w-4 text-primary" }), _jsx("p", { className: "text-sm font-semibold text-white", children: step.title })] }), _jsx("p", { className: "text-sm text-muted-foreground", children: step.description })] }), _jsxs("div", { className: "flex items-center gap-2", children: [stepState === 'done' ? _jsx(Check, { className: "h-4 w-4 text-emerald-400" }) : null, _jsx(ChevronDown, { className: `h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}` })] })] }), _jsxs(CollapsibleContent, { className: "pt-3", children: [step.id === 1 ? (_jsxs("div", { className: "flex flex-wrap gap-3", children: [_jsxs(Button, { size: "sm", variant: "secondary", onClick: handleCreateInstance, disabled: !canCreateInstance, children: [_jsx(Plus, { className: "mr-2 h-4 w-4" }), " Nova inst\u00E2ncia"] }), _jsx(Button, { size: "sm", variant: "ghost", onClick: () => setShowInstanceManager(true), children: "Ver inst\u00E2ncias" }), !canCreateInstance && createInstanceWarning ? (_jsx("p", { className: "text-xs text-amber-200", children: createInstanceWarning })) : null] })) : null, step.id === 2 ? (_jsxs("div", { className: "space-y-3", children: [_jsx("div", { className: "rounded-xl border border-dashed border-border/70 bg-surface-overlay-quiet p-4 text-center text-sm text-muted-foreground", children: qrImageSrc ? (_jsx("img", { src: qrImageSrc, alt: "QR Code", className: "mx-auto h-40 w-40 rounded" })) : ('Sem QR Code ativo · Gere um novo código após instalar o agente.') }), _jsxs("div", { className: "flex flex-wrap gap-3", children: [_jsxs(Button, { size: "sm", onClick: handleGenerateQr, disabled: isGeneratingQrImage || isBusy, children: [isGeneratingQrImage ? (_jsx(Loader2, { className: "mr-2 h-4 w-4 animate-spin" })) : (_jsx(QrCode, { className: "mr-2 h-4 w-4" })), isGeneratingQrImage ? 'Gerando…' : 'Gerar novo QR'] }), _jsx(Button, { size: "sm", variant: "secondary", onClick: () => updateWizardState({ qrConfirmed: true }), children: "Marcar como lido" })] })] })) : null, step.id === 3 ? (_jsxs("div", { className: "flex flex-wrap gap-3", children: [_jsxs(Button, { size: "sm", onClick: () => updateWizardState({ validationDone: true }), children: [_jsx(MessageSquare, { className: "mr-2 h-4 w-4" }), " Enviar mensagem de teste"] }), _jsx(Button, { size: "sm", variant: "ghost", onClick: () => handleMarkConnected(), children: "Confirmar manualmente" })] })) : null] })] }, step.id));
                                    }) }), _jsxs("div", { className: "rounded-[calc(var(--radius)_-_2px)] border border-dashed border-border/60 bg-surface-overlay-quiet p-4", children: [_jsx("p", { className: "text-sm text-muted-foreground", children: "Precisa ajustar inst\u00E2ncias existentes? Utilize o painel abaixo quando necess\u00E1rio." }), _jsx("div", { className: "mt-3", children: _jsx(Button, { size: "sm", variant: "secondary", onClick: () => setShowInstanceManager((value) => !value), children: showInstanceManager ? 'Ocultar gerenciador' : 'Gerenciar instâncias' }) })] }), showInstanceManager ? (_jsx("div", { className: "space-y-4", children: _jsx(Suspense, { fallback: _jsx(SectionFallback, {}), children: _jsx(InstancesPanel, { surfaceStyles: surfaceStyles, selectedInstance: selectedInstance, selectedInstanceStatusInfo: selectedInstanceStatusInfo, selectedInstancePhone: selectedInstancePhone, instancesReady: instancesReady, hasHiddenInstances: hasHiddenInstances, hasRenderableInstances: hasRenderableInstances, instanceViewModels: instanceViewModels, showFilterNotice: showFilterNotice, instancesCountLabel: instancesCountLabel, errorState: errorState, isBusy: isBusy, isAuthenticated: isAuthenticated, loadingInstances: loadingInstances, copy: copy, localStatus: localStatus, onMarkConnected: handleMarkConnected, onRefresh: handleRefreshInstances, onCreateInstance: handleCreateInstance, createInstanceDisabled: !canCreateInstance, createInstanceWarning: createInstanceWarning, onShowAll: () => setShowAllInstances(true), onRetry: handleRetry, onSelectInstance: handleInstanceSelect, onViewQr: handleViewQr, onRequestDelete: setInstancePendingDelete, deletingInstanceId: deletingInstanceId, statusCodeMeta: statusCodeMeta, qrStatusMessage: qrStatusMessage, countdownMessage: countdownMessage, canContinue: canContinue, canCreateCampaigns: canCreateCampaigns, onViewLogs: undefined, onRenameInstance: undefined }) }) })) : null] }) }), _jsxs("aside", { className: "space-y-6", children: [_jsxs("section", { className: "glass-surface space-y-4 rounded-[var(--radius)] border border-border/60 px-5 py-6 shadow-sm", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "space-y-1", children: [_jsx("span", { className: "text-xs uppercase tracking-wide text-muted-foreground", children: "Resumo r\u00E1pido" }), _jsx("h2", { className: "text-lg font-semibold text-white", children: "Objetivo" })] }), _jsx(Badge, { variant: "secondary", children: statusCopy.badge })] }), _jsxs("p", { className: "text-sm text-muted-foreground", children: ["Conectar ", instanceName, " ao n\u00FAmero ", numberLabel, " e liberar m\u00E9tricas avan\u00E7adas."] }), _jsxs("div", { className: "space-y-3 text-sm text-muted-foreground", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { children: "Modo" }), _jsx("span", { className: "font-medium text-white", children: modeLabel })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { children: "N\u00FAmero alvo" }), _jsx("span", { className: "font-medium text-white", children: numberLabel })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { children: "Plano" }), _jsx("span", { className: "font-medium text-white", children: planLabel })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { children: "Mensagens hoje" }), _jsx("span", { className: "font-medium text-white", children: usageLabel })] })] }), _jsxs("div", { children: [_jsx("h3", { className: "text-xs uppercase tracking-wide text-muted-foreground", children: "Tarefas pendentes" }), _jsxs("ul", { className: "mt-2 space-y-1 text-sm text-muted-foreground", children: [checklistItems
                                                        .filter((item) => item.state !== 'done')
                                                        .map((item) => (_jsxs("li", { className: "flex items-center gap-2", children: [_jsx("span", { className: "h-1.5 w-1.5 rounded-full bg-primary" }), item.title] }, item.id))), checklistItems.every((item) => item.state === 'done') ? (_jsxs("li", { className: "flex items-center gap-2 text-emerald-300", children: [_jsx(Check, { className: "h-4 w-4" }), " Tudo pronto"] })) : null] })] })] }), _jsxs("section", { className: "glass-surface space-y-4 rounded-[var(--radius)] border border-border/60 px-5 py-6 shadow-sm", children: [_jsxs("div", { className: "space-y-1", children: [_jsx("span", { className: "text-xs uppercase tracking-wide text-muted-foreground", children: "Ajuda contextual" }), _jsx("h2", { className: "text-lg font-semibold text-white", children: "Precisa de apoio?" })] }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Conex\u00E3o segura: valida o agente e tokens. Canal est\u00E1vel: garante heartbeat e eventos. Pronto para iniciar: fila e mensagens sincronizadas." }), _jsx(Button, { size: "sm", variant: "secondary", children: "Ver FAQ desta etapa" })] })] })] }), _jsxs("section", { className: "space-y-6", children: [_jsxs("div", { className: "glass-surface space-y-4 rounded-[var(--radius)] border border-border/60 px-5 py-6 shadow-sm", children: [_jsxs("div", { className: "flex flex-col gap-2", children: [_jsx("span", { className: "text-xs uppercase tracking-wide text-muted-foreground", children: "API & M\u00E9tricas" }), _jsx("h2", { className: "text-lg font-semibold text-white", children: "Sa\u00FAde operacional" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "KPIs s\u00F3 ficam dispon\u00EDveis ap\u00F3s a inst\u00E2ncia estar online. Quando isso acontecer, mostramos uptime, fila e erros/minuto." })] }), metricsAvailable ? (_jsxs("div", { className: "grid gap-4 md:grid-cols-3", children: [_jsxs("div", { className: "rounded-xl border border-border/60 bg-surface-overlay-quiet p-4", children: [_jsx("p", { className: "text-xs uppercase tracking-wide text-muted-foreground", children: "Uptime" }), _jsx("p", { className: "text-2xl font-semibold text-white", children: uptimeLabel }), _jsx("p", { className: "text-xs text-muted-foreground", children: "\u00DAltimas 24h" })] }), _jsxs("div", { className: "rounded-xl border border-border/60 bg-surface-overlay-quiet p-4", children: [_jsx("p", { className: "text-xs uppercase tracking-wide text-muted-foreground", children: "Lat\u00EAncia m\u00E9dia" }), _jsx("p", { className: "text-2xl font-semibold text-white", children: latencyLabel }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Envios recentes" })] }), _jsxs("div", { className: "rounded-xl border border-border/60 bg-surface-overlay-quiet p-4", children: [_jsx("p", { className: "text-xs uppercase tracking-wide text-muted-foreground", children: "Fila" }), _jsx("p", { className: "text-2xl font-semibold text-white", children: currentInstance?.metrics?.status?.queued ?? 0 }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Mensagens aguardando" })] })] })) : (_jsx("div", { className: "rounded-xl border border-dashed border-border/60 bg-surface-overlay-quiet p-4 text-sm text-muted-foreground", children: "Conecte a inst\u00E2ncia para liberar m\u00E9tricas de API, fila e uptime." }))] }), _jsxs("div", { className: "grid gap-6 lg:grid-cols-2", children: [_jsxs("div", { className: "glass-surface space-y-4 rounded-[var(--radius)] border border-border/60 px-5 py-6 shadow-sm", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("span", { className: "text-xs uppercase tracking-wide text-muted-foreground", children: "A\u00E7\u00F5es pendentes" }), _jsx("h2", { className: "text-lg font-semibold text-white", children: "Opera\u00E7\u00F5es em aberto" })] }), _jsx(Button, { size: "sm", variant: "secondary", onClick: handleRefreshInstances, children: "Atualizar" })] }), _jsxs("ul", { className: "space-y-2 text-sm text-muted-foreground", children: [_jsxs("li", { className: "flex items-center gap-2", children: [_jsx("span", { className: "h-1.5 w-1.5 rounded-full bg-primary" }), qrStatusMessage ?? 'Aguardando leitura do QR Code.'] }), countdownMessage ? (_jsxs("li", { className: "flex items-center gap-2 text-amber-200", children: [_jsx(Clock, { className: "h-4 w-4" }), " ", countdownMessage] })) : null, !canContinue ? (_jsxs("li", { className: "flex items-center gap-2 text-muted-foreground", children: [_jsx(Shield, { className: "h-4 w-4" }), " Conclua o assistente para liberar a Inbox."] })) : (_jsxs("li", { className: "flex items-center gap-2 text-emerald-300", children: [_jsx(Check, { className: "h-4 w-4" }), " Tudo certo para avan\u00E7ar."] }))] })] }), _jsxs("div", { className: "glass-surface space-y-4 rounded-[var(--radius)] border border-border/60 px-5 py-6 shadow-sm", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("span", { className: "text-xs uppercase tracking-wide text-muted-foreground", children: "Hist\u00F3rico" }), _jsx("h2", { className: "text-lg font-semibold text-white", children: "Logs recentes" })] }), _jsx(Button, { size: "sm", variant: "ghost", onClick: () => setQrPanelOpen(true), children: "Ver completo" })] }), timelinePreview.length ? (_jsx("ul", { className: "space-y-3 text-sm text-muted-foreground", children: timelinePreview.map((item) => (_jsxs("li", { className: "rounded-xl border border-border/60 bg-surface-overlay-quiet p-3", children: [_jsx("p", { className: "text-xs uppercase tracking-wide text-muted-foreground", children: item.timestampLabel }), _jsx("p", { className: "text-sm text-white", children: item.title }), item.description ? _jsx("p", { className: "text-xs text-muted-foreground", children: item.description }) : null] }, item.id ?? item.timestamp))) })) : (_jsx("p", { className: "text-sm text-muted-foreground", children: "Nenhum evento recente para mostrar." }))] })] }), _jsx(Suspense, { fallback: _jsx(SectionFallback, {}), children: _jsx(AdvancedOperationsPanel, { surfaceStyles: surfaceStyles, open: qrPanelOpen, onOpenChange: (value) => setQrPanelOpen(value), qrStatusMessage: qrStatusMessage, pairingPhoneInput: pairingPhoneInput, onPairingPhoneChange: handlePairingPhoneChange, pairingDisabled: !selectedInstance || requestingPairingCode || isBusy, requestingPairingCode: requestingPairingCode, onRequestPairingCode: handleRequestPairingCode, pairingPhoneError: pairingPhoneError, timelineItems: timelineItems, realtimeConnected: realtimeConnected }) })] }), _jsx(Suspense, { fallback: _jsx(DialogFallback, {}), children: _jsx(CreateInstanceDialog, { open: isCreateInstanceOpen, onOpenChange: setCreateInstanceOpen, defaultName: defaultInstanceName, disabledReason: createInstanceWarning, onSubmit: submitCreateInstance }) }), _jsx(Suspense, { fallback: _jsx(DialogFallback, {}), children: _jsx(Dialog, { open: isQrDialogOpen, onOpenChange: (value) => setQrDialogOpen(value), children: _jsxs(DialogContent, { className: "max-w-lg", children: [_jsxs(DialogHeader, { className: "space-y-1", children: [_jsx(DialogTitle, { className: "text-lg font-semibold", children: "QR Code ativo" }), _jsx(DialogDescription, { className: "text-sm text-muted-foreground", children: "Escaneie com o aplicativo oficial para concluir a sincroniza\u00E7\u00E3o." })] }), _jsx(QrPreview, { src: qrImageSrc ?? null, statusMessage: qrStatusMessage ?? null, isGenerating: isGeneratingQrImage, onGenerate: handleGenerateQr, onOpen: (() => setQrDialogOpen(true)), generateDisabled: isBusy, openDisabled: false, className: "rounded-xl border border-dashed border-border/60 p-6", illustrationClassName: surfaceStyles.qrIllustration })] }) }) }), _jsx(AlertDialog, { open: deletionDialog.open, onOpenChange: (value) => {
                    if (!value) {
                        setInstancePendingDelete(null);
                    }
                }, children: _jsxs(AlertDialogContent, { className: "space-y-4", children: [_jsxs(AlertDialogHeader, { className: "space-y-2", children: [_jsx(AlertDialogTitle, { className: "text-lg font-semibold", children: deletionDialog.title }), _jsxs(AlertDialogDescription, { className: "text-sm text-muted-foreground", children: ["Confirme para remover ", deletionDialog.targetLabel, "."] })] }), _jsxs(AlertDialogFooter, { className: "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", children: [_jsx(AlertDialogCancel, { className: "mt-2 sm:mt-0", onClick: () => setInstancePendingDelete(null), children: "Cancelar" }), _jsx(AlertDialogAction, { onClick: () => deletionDialog.target && handleDeleteInstance(deletionDialog.target), className: "bg-destructive hover:bg-destructive/90", children: deletionDialog.actionLabel })] })] }) }), errorState ? (_jsxs("div", { className: "flex flex-wrap items-start gap-3 rounded-[var(--radius)] border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive", children: [_jsx(AlertCircle, { className: "mt-0.5 h-4 w-4" }), _jsxs("div", { className: "flex-1 space-y-1", children: [_jsx("p", { className: "font-medium", children: errorState.title ?? 'Algo deu errado' }), _jsx("p", { children: errorState.message })] }), _jsx("div", { className: "flex flex-col gap-2 sm:flex-row", children: _jsx(Button, { size: "sm", variant: "outline", onClick: () => void loadInstances({ forceRefresh: true }), children: "Tentar novamente" }) })] })) : null] }));
};
export default WhatsAppConnect;
