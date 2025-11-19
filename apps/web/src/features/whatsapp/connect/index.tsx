import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card } from '@/components/ui/card.jsx';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx';
import { Separator } from '@/components/ui/separator.jsx';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog.jsx';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  QrCode,
  Rocket,
  Shield,
  Smartphone,
} from 'lucide-react';

import useWhatsAppConnect from './useWhatsAppConnect';

const InstancesPanel = lazy(() => import('../components/InstancesPanel.jsx'));
const CreateInstanceDialog = lazy(() => import('../components/CreateInstanceDialog.jsx'));
const QrPreview = lazy(() => import('../components/QrPreview.jsx'));
const AdvancedOperationsPanel = lazy(() => import('../components/AdvancedOperationsPanel.jsx'));

const SectionFallback = () => (
  <Card className="border border-border/60 bg-surface-overlay-quiet p-6 text-sm text-muted-foreground">
    Carregando…
  </Card>
);

const DialogFallback = () => null;

const modeDescriptions = {
  session: 'Ideal para times que compartilham a mesma sessão conectada em múltiplos dispositivos.',
  number: 'Modo dedicado para um único número fixo. Use quando houver apenas um operador.',
} as const;

const connectionStepsCopy = [
  {
    id: 'secure',
    label: 'Conexão segura',
    description: 'Validar ambiente e autenticar o agente que irá parear o WhatsApp.',
    Icon: Shield,
  },
  {
    id: 'stable',
    label: 'Canal estável',
    description: 'Sincronizar eventos e garantir que o canal permaneça online.',
    Icon: Activity,
  },
  {
    id: 'ready',
    label: 'Pronto para iniciar',
    description: 'Fila validada e disparos autorizados para começar a operar.',
    Icon: Rocket,
  },
] as const;

const wizardSteps = [
  {
    id: 1,
    title: 'Selecione o modo de conexão',
    description: 'Escolha entre sessão compartilhada ou número dedicado para continuar.',
    Icon: Smartphone,
  },
  {
    id: 2,
    title: 'Leia o QR Code oficial',
    description: 'Acesse Dispositivos Conectados no WhatsApp e escaneie o código.',
    Icon: QrCode,
  },
] as const;

const WhatsAppConnect = (props: Parameters<typeof useWhatsAppConnect>[0]) => {
  const {
    surfaceStyles,
    statusCopy,
    statusTone,
    countdownMessage,
    confirmLabel,
    confirmDisabled,
    qrImageSrc,
    isGeneratingQrImage,
    qrStatusMessage,
    hasAgreement,
    agreementDisplayName,
    selectedAgreement,
    selectedInstance,
    selectedInstancePhone,
    selectedInstanceStatusInfo,
    instancesReady,
    hasHiddenInstances,
    hasRenderableInstances,
    instanceViewModels,
    showFilterNotice,
    instancesCountLabel,
    loadingInstances,
    isAuthenticated,
    copy,
    localStatus,
    onBack,
    onContinue,
    handleRefreshInstances,
    handleCreateInstance,
    submitCreateInstance,
    campaign,
    setShowAllInstances,
    setQrPanelOpen,
    setQrDialogOpen,
    pairingPhoneInput,
    pairingPhoneError,
    requestingPairingCode,
    handlePairingPhoneChange,
    handleRequestPairingCode,
    timelineItems,
    realtimeConnected,
    handleInstanceSelect,
    handleViewQr,
    handleGenerateQr,
    handleMarkConnected,
    handleDeleteInstance,
    deletionDialog,
    setInstancePendingDelete,
    isBusy,
    canContinue,
    qrPanelOpen,
    isQrDialogOpen,
    hasCampaign,
    statusCodeMeta,
    defaultInstanceName,
    deletingInstanceId,
    errorState,
    loadInstances,
    showAllInstances,
    handleRetry,
    setCreateInstanceOpen,
    isCreateInstanceOpen,
    nextStage,
    stepLabel,
    onboardingDescription,
    canCreateCampaigns,
  } = useWhatsAppConnect(props);

  const instanceHealth = useMemo(() => {
    const totals = { connected: 0, connecting: 0, needsAttention: 0, offline: 0 };

    if (!instancesReady) {
      return { state: 'loading' as const, total: instanceViewModels.length, totals };
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
      state: total === 0 ? ('empty' as const) : ('ready' as const),
      total,
      totals,
    };
  }, [instanceViewModels, instancesReady]);

  const [wizardState, setWizardState] = useState({
    mode: selectedInstance?.instance?.mode === 'number' ? 'number' : 'session',
    qrConfirmed: localStatus === 'connected',
  });

  useEffect(() => {
    if (selectedInstance?.instance?.mode) {
      setWizardState((prev) => ({
        ...prev,
        mode: selectedInstance.instance.mode === 'number' ? 'number' : 'session',
      }));
    }
  }, [selectedInstance?.instance?.mode]);

  useEffect(() => {
    setWizardState((prev) => ({ ...prev, qrConfirmed: localStatus === 'connected' }));
  }, [localStatus]);

  const [showInstanceManager, setShowInstanceManager] = useState(!selectedInstance);
  useEffect(() => {
    if (!selectedInstance) {
      setShowInstanceManager(true);
    }
  }, [selectedInstance]);

  const assistantRef = useRef<HTMLDivElement | null>(null);
  const scrollToAssistant = () => assistantRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const activeStepIndex = useMemo(() => {
    switch (localStatus) {
      case 'connected':
        return 2;
      case 'connecting':
        return 1;
      default:
        return 0;
    }
  }, [localStatus]);

  const connectionSteps = useMemo(() => {
    return connectionStepsCopy.map((step, index) => {
      let state: 'done' | 'active' | 'pending' | 'blocked' = 'pending';
      if (index < activeStepIndex) {
        state = 'done';
      } else if (index === activeStepIndex) {
        state = localStatus === 'qr_required' && index > 0 ? 'blocked' : 'active';
      }
      return { ...step, state };
    });
  }, [activeStepIndex, localStatus]);

  const updateWizardState = (patch: Partial<typeof wizardState>) => {
    setWizardState((prev) => ({ ...prev, ...patch }));
  };

  const checklistItems = useMemo(() => {
    const isModeSelected = Boolean(wizardState.mode);
    const qrReady = wizardState.qrConfirmed;
    const channelConnecting = localStatus === 'connecting';
    const channelOnline = localStatus === 'connected';

    return [
      {
        id: 'mode',
        title: 'Definir modo de conexão',
        description: 'Escolha se a instância será por sessão ou por número.',
        state: isModeSelected ? 'done' : 'pending',
        actionLabel: isModeSelected ? 'Configurado' : 'Selecionar modo',
      },
      {
        id: 'agent',
        title: 'Instalar agente/serviço',
        description: 'Faça o download e instale o agente de pareamento autorizado.',
        state: channelConnecting || channelOnline ? 'done' : isModeSelected ? 'in_progress' : 'pending',
        actionLabel: channelConnecting || channelOnline ? 'Instalado' : 'Baixar agente',
      },
      {
        id: 'qr',
        title: 'Ler QR Code do WhatsApp',
        description: 'Escaneie o QR dentro de Dispositivos Conectados no app oficial.',
        state: qrReady ? 'done' : channelConnecting || channelOnline ? 'in_progress' : 'pending',
        actionLabel: qrReady ? 'Conectado' : 'Gerar QR',
      },
      {
        id: 'events',
        title: 'Validar eventos e fila',
        description: 'Confira se as mensagens entrantes e a fila estão sincronizadas.',
        state: qrReady ? (channelOnline ? 'done' : 'in_progress') : 'pending',
        actionLabel: channelOnline ? 'Validado' : 'Ver fila',
      },
      {
        id: 'test',
        title: 'Testar envio/recebimento',
        description: 'Envie uma mensagem de teste e confirme o recebimento de volta.',
        state: channelOnline ? 'done' : qrReady ? 'in_progress' : 'pending',
        actionLabel: channelOnline ? 'Teste concluído' : 'Testar agora',
      },
    ];
  }, [localStatus, wizardState.mode, wizardState.qrConfirmed]);

  const metricsAvailable = localStatus === 'connected';
  const timelinePreview = timelineItems.slice(0, 4);
  const planLabel =
    (selectedInstance?.instance && selectedInstance.instance.plan) ||
    (selectedInstance?.instance && selectedInstance.instance.tier) ||
    'Plano padrão';
  const rateUsage = selectedInstance?.rateUsage ?? selectedInstance?.metrics?.rateUsage;
  const usageLabel = rateUsage
    ? `${rateUsage.used ?? 0}/${rateUsage.limit ?? 0} msgs hoje`
    : `${Math.round(selectedInstance?.ratePercentage ?? 0)}% do limite`;
  const numberLabel = selectedInstancePhone || selectedInstance?.phoneLabel || 'Sem número definido';
  const instanceName = selectedInstance?.displayName ?? defaultInstanceName;
  const modeLabel = wizardState.mode === 'number' ? 'Instância por número' : 'Instância por sessão';

  const backLabel = 'Voltar';

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="glass-surface space-y-6 rounded-[var(--radius)] border border-[var(--border)] px-6 py-5 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-[color:var(--color-inbox-foreground-muted)]/80">
              <Badge variant="secondary">{stepLabel}</Badge>
              {nextStage ? <span>Próximo: {nextStage}</span> : null}
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-foreground">Instância WhatsApp · {instanceName}</h1>
              <p className="max-w-2xl text-sm text-muted-foreground">{onboardingDescription}</p>
            </div>
            {onBack ? (
              <Button variant="ghost" size="sm" onClick={onBack} className="w-fit">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {backLabel}
              </Button>
            ) : null}
          </div>
          <div className="flex flex-col gap-3 text-xs text-muted-foreground">
            <Badge variant="status" tone={statusTone as any} className="gap-2 text-xs font-medium uppercase">
              {statusCopy.badge}
            </Badge>
            <div className="flex flex-wrap items-center justify-end gap-2 text-[0.7rem]">
              {instanceHealth.state === 'loading' ? (
                <Badge variant="status" tone="info">Sincronizando instâncias…</Badge>
              ) : instanceHealth.state === 'empty' ? (
                <Badge variant="status" tone="info">Nenhuma instância conectada</Badge>
              ) : (
                <>
                  <Badge variant="status" tone="success">
                    {instanceHealth.totals.connected} conectada(s)
                  </Badge>
                  {instanceHealth.totals.connecting ? (
                    <Badge variant="status" tone="info">
                      {instanceHealth.totals.connecting} sincronizando
                    </Badge>
                  ) : null}
                  {instanceHealth.totals.needsAttention ? (
                    <Badge variant="status" tone="warning">
                      {instanceHealth.totals.needsAttention} requer(em) ação
                    </Badge>
                  ) : null}
                  {instanceHealth.totals.offline ? (
                    <Badge variant="status" tone="neutral">
                      {instanceHealth.totals.offline} offline
                    </Badge>
                  ) : null}
                </>
              )}
              <span className="text-[0.65rem] uppercase tracking-wide text-muted-foreground/80">{instancesCountLabel}</span>
            </div>
            {countdownMessage ? (
              <span className="flex items-center gap-1 text-amber-200" role="status" aria-live="polite">
                <Clock className="h-3.5 w-3.5" />
                {countdownMessage}
              </span>
            ) : null}
          </div>
        </div>
        <Separator className="section-divider" />
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="border-indigo-400/60 text-indigo-100">
              Plano: {planLabel}
            </Badge>
            <Badge variant="outline" className="border-slate-500/60 text-slate-100">
              Limite diário: {rateUsage?.limit ? `${rateUsage.limit} msgs` : 'Automático'}
            </Badge>
            <Badge variant="outline" className="border-emerald-500/60 text-emerald-100">
              {usageLabel}
            </Badge>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
              <span className="text-xs uppercase tracking-wide">Modo atual</span>
              <div className="flex items-center gap-2">
                {(['session', 'number'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => updateWizardState({ mode })}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      wizardState.mode === mode
                        ? 'border-primary/60 bg-primary/10 text-white'
                        : 'border-border/60 text-muted-foreground hover:border-primary/40'
                    }`}
                  >
                    {mode === 'session' ? 'Instância por sessão' : 'Instância por número'}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{modeDescriptions[wizardState.mode]}</p>
          </div>
          <div className="flex flex-col gap-2">
            <Button onClick={scrollToAssistant} className="justify-center">
              Iniciar conexão
            </Button>
            <p className="text-[0.7rem] text-muted-foreground">
              Este botão leva você diretamente ao Assistente de Conexão.
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="space-y-6">
          <section className="glass-surface rounded-[var(--radius)] border border-border/60 px-5 py-6 shadow-sm">
            <div className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Linha do tempo do canal</span>
              <h2 className="text-lg font-semibold text-white">Acompanhe o progresso</h2>
              <p className="text-sm text-muted-foreground">As próximas etapas são desbloqueadas automaticamente conforme a conexão avança.</p>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {connectionSteps.map((step) => (
                <div
                  key={step.id}
                  className={`rounded-xl border p-4 transition-colors ${
                    step.state === 'done'
                      ? 'border-emerald-500/50 bg-emerald-500/10'
                      : step.state === 'active'
                        ? 'border-primary/60 bg-primary/5'
                        : step.state === 'blocked'
                          ? 'border-destructive/60 bg-destructive/5'
                          : 'border-border/60 bg-surface-overlay-quiet'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`rounded-full p-2 ${
                        step.state === 'done'
                          ? 'bg-emerald-500/20 text-emerald-200'
                          : step.state === 'active'
                            ? 'bg-primary/20 text-primary-foreground'
                            : 'bg-muted/30 text-muted-foreground'
                      }`}
                    >
                      <step.Icon className="h-4 w-4" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-white">{step.label}</p>
                      <p className="text-xs text-muted-foreground">{step.description}</p>
                    </div>
                  </div>
                  <div className="mt-4 text-xs uppercase tracking-wide text-muted-foreground">
                    {step.state === 'done'
                      ? 'Concluído'
                      : step.state === 'active'
                        ? 'Em andamento'
                        : step.state === 'blocked'
                          ? 'Aguardando etapa anterior'
                          : 'Pendente'}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section
            ref={assistantRef}
            id="assistente-de-conexao"
            className="glass-surface space-y-6 rounded-[var(--radius)] border border-border/60 px-5 py-6 shadow-sm"
          >
            <div className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Assistente de conexão</span>
              <h2 className="text-lg font-semibold text-white">Configure sua instância</h2>
              <p className="text-sm text-muted-foreground">
                Complete cada subetapa em ordem. Recursos avançados só são exibidos após a conexão.
              </p>
            </div>
            <div className="grid gap-4">
              {wizardSteps.map((step) => {
                const stepState = (() => {
                  if (step.id === 1) {
                    return wizardState.mode ? 'done' : 'active';
                  }
                  if (step.id === 2) {
                    if (!wizardState.mode) {
                      return 'blocked';
                    }
                    return wizardState.qrConfirmed ? 'done' : 'active';
                  }
                  return 'pending';
                })();

                const stateClasses =
                  stepState === 'done'
                    ? 'border-emerald-500/60'
                    : stepState === 'active'
                      ? 'border-primary/40'
                      : 'border-border/60';

                const isDisabled = stepState === 'blocked';

                return (
                  <div
                    key={step.id}
                    className={`flex flex-col gap-4 rounded-[calc(var(--radius)_-_2px)] border px-4 py-4 ${stateClasses} ${
                      isDisabled ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="rounded-full border border-border/60 bg-surface-overlay-quiet px-3 py-1 text-xs font-semibold">
                        {step.id}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <step.Icon className="h-4 w-4 text-primary" />
                          <p className="text-sm font-semibold text-white">{step.title}</p>
                        </div>
                        <p className="text-sm text-muted-foreground">{step.description}</p>
                      </div>
                      {stepState === 'done' ? <Check className="h-4 w-4 text-emerald-400" /> : null}
                    </div>
                    {step.id === 1 ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        {(['session', 'number'] as const).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => updateWizardState({ mode })}
                            className={`flex flex-col gap-2 rounded-xl border px-4 py-3 text-left transition ${
                              wizardState.mode === mode
                                ? 'border-primary/70 bg-primary/10 text-white'
                                : 'border-border/60 text-muted-foreground hover:border-primary/40'
                            }`}
                          >
                            <span className="text-sm font-semibold">
                              {mode === 'session' ? 'Instância por sessão' : 'Instância por número'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {mode === 'session'
                                ? 'Compartilhe a sessão em diferentes navegadores.'
                                : 'Cada agente usa um único número dedicado.'}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {step.id === 2 ? (
                      <div className="space-y-3">
                        <div className="rounded-xl border border-dashed border-border/70 bg-surface-overlay-quiet p-4 text-center text-sm text-muted-foreground">
                          {qrImageSrc ? (
                            <img src={qrImageSrc} alt="QR Code" className="mx-auto h-40 w-40 rounded" />
                          ) : (
                            'Sem QR Code ativo · Gere um novo código quando estiver pronto.'
                          )}
                        </div>
                        <div className="flex flex-wrap gap-3">
                          <Button size="sm" onClick={handleGenerateQr} disabled={isGeneratingQrImage || isBusy}>
                            {isGeneratingQrImage ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <QrCode className="mr-2 h-4 w-4" />
                            )}
                            {isGeneratingQrImage ? 'Gerando…' : 'Gerar novo QR'}
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => updateWizardState({ qrConfirmed: true })}>
                            Marcar como lido
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div className="rounded-[calc(var(--radius)_-_2px)] border border-dashed border-border/60 bg-surface-overlay-quiet p-4">
              <p className="text-sm text-muted-foreground">
                Precisa ajustar instâncias existentes? Utilize o painel abaixo quando necessário.
              </p>
              <div className="mt-3">
                <Button size="sm" variant="secondary" onClick={() => setShowInstanceManager((value) => !value)}>
                  {showInstanceManager ? 'Ocultar gerenciador' : 'Gerenciar instâncias' }
                </Button>
              </div>
            </div>
            {showInstanceManager ? (
              <div className="space-y-4">
                <Suspense fallback={<SectionFallback />}>
                  <InstancesPanel
                    surfaceStyles={surfaceStyles}
                    hasAgreement={hasAgreement}
                    agreementDisplayName={agreementDisplayName}
                    selectedAgreementRegion={selectedAgreement?.region ?? null}
                    selectedAgreementId={selectedAgreement?.id ?? null}
                    selectedInstance={selectedInstance}
                    selectedInstanceStatusInfo={selectedInstanceStatusInfo}
                    selectedInstancePhone={selectedInstancePhone}
                    hasCampaign={hasCampaign}
                    campaign={campaign}
                    instancesReady={instancesReady}
                    hasHiddenInstances={hasHiddenInstances}
                    hasRenderableInstances={hasRenderableInstances}
                    instanceViewModels={instanceViewModels}
                    instanceHealth={instanceHealth}
                    showFilterNotice={showFilterNotice}
                    showAllInstances={showAllInstances}
                    instancesCountLabel={instancesCountLabel}
                    errorState={errorState}
                    isBusy={isBusy}
                    isAuthenticated={isAuthenticated}
                    loadingInstances={loadingInstances}
                    copy={copy}
                    localStatus={localStatus}
                    confirmLabel={confirmLabel}
                    confirmDisabled={confirmDisabled}
                    onConfirm={onContinue}
                    onMarkConnected={handleMarkConnected}
                    onRefresh={handleRefreshInstances}
                    onCreateInstance={handleCreateInstance}
                    onShowAll={() => setShowAllInstances(true)}
                    onRetry={handleRetry}
                    onSelectInstance={handleInstanceSelect}
                    onViewQr={handleViewQr}
                    onRequestDelete={setInstancePendingDelete}
                    deletingInstanceId={deletingInstanceId}
                    statusCodeMeta={statusCodeMeta}
                    qrStatusMessage={qrStatusMessage}
                    countdownMessage={countdownMessage}
                    canContinue={canContinue}
                    canCreateCampaigns={canCreateCampaigns}
                  />
                </Suspense>
              </div>
            ) : null}
          </section>

          <section className="glass-surface space-y-4 rounded-[var(--radius)] border border-border/60 px-5 py-6 shadow-sm">
            <div className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Checklist de configuração</span>
              <h2 className="text-lg font-semibold text-white">Próximas ações</h2>
              <p className="text-sm text-muted-foreground">
                Cada item indica o estado atual da jornada. Priorize o que estiver pendente.
              </p>
            </div>
            <ol className="space-y-3">
              {checklistItems.map((item, index) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-2 rounded-[calc(var(--radius)_-_2px)] border border-border/60 bg-surface-overlay-quiet p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-full border border-border/60 px-3 py-1 text-xs font-semibold">{index + 1}</div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                    {item.state === 'done' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : item.state === 'in_progress' ? (
                      <Clock className="h-4 w-4 text-amber-300" />
                    ) : null}
                  </div>
                  <Button size="sm" variant={item.state === 'done' ? 'ghost' : 'secondary'}>
                    {item.actionLabel}
                  </Button>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="glass-surface space-y-4 rounded-[var(--radius)] border border-border/60 px-5 py-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">Resumo rápido</span>
                <h2 className="text-lg font-semibold text-white">Objetivo</h2>
              </div>
              <Badge variant="secondary">{statusCopy.badge}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Conectar {instanceName} ao número {numberLabel} e liberar métricas avançadas.
            </p>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>Modo</span>
                <span className="font-medium text-white">{modeLabel}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Número alvo</span>
                <span className="font-medium text-white">{numberLabel}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Plano</span>
                <span className="font-medium text-white">{planLabel}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Mensagens hoje</span>
                <span className="font-medium text-white">{usageLabel}</span>
              </div>
            </div>
            <div>
              <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Tarefas pendentes</h3>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {checklistItems
                  .filter((item) => item.state !== 'done')
                  .map((item) => (
                    <li key={item.id} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary"></span>
                      {item.title}
                    </li>
                  ))}
                {checklistItems.every((item) => item.state === 'done') ? (
                  <li className="flex items-center gap-2 text-emerald-300">
                    <Check className="h-4 w-4" /> Tudo pronto
                  </li>
                ) : null}
              </ul>
            </div>
          </section>

          <section className="glass-surface space-y-4 rounded-[var(--radius)] border border-border/60 px-5 py-6 shadow-sm">
            <div className="space-y-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Ajuda contextual</span>
              <h2 className="text-lg font-semibold text-white">Precisa de apoio?</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Conexão segura: valida o agente e tokens. Canal estável: garante heartbeat e eventos. Pronto para iniciar: fila e
              mensagens sincronizadas.
            </p>
            <Button size="sm" variant="secondary">
              Ver FAQ desta etapa
            </Button>
          </section>
        </aside>
      </div>

      <section className="space-y-6">
        <div className="glass-surface space-y-4 rounded-[var(--radius)] border border-border/60 px-5 py-6 shadow-sm">
          <div className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">API & Métricas</span>
            <h2 className="text-lg font-semibold text-white">Saúde operacional</h2>
            <p className="text-sm text-muted-foreground">
              KPIs só ficam disponíveis após a instância estar online. Quando isso acontecer, mostramos uptime, fila e erros/minuto.
            </p>
          </div>
          {metricsAvailable ? (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-border/60 bg-surface-overlay-quiet p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Uptime</p>
                <p className="text-2xl font-semibold text-white">{selectedInstance?.metrics?.uptime ?? '99,9%'}</p>
                <p className="text-xs text-muted-foreground">Últimas 24h</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-surface-overlay-quiet p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Latência média</p>
                <p className="text-2xl font-semibold text-white">{selectedInstance?.metrics?.latency ?? '320ms'}</p>
                <p className="text-xs text-muted-foreground">Envios recentes</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-surface-overlay-quiet p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Fila</p>
                <p className="text-2xl font-semibold text-white">{selectedInstance?.metrics?.status?.queued ?? 0}</p>
                <p className="text-xs text-muted-foreground">Mensagens aguardando</p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border/60 bg-surface-overlay-quiet p-4 text-sm text-muted-foreground">
              Conecte a instância para liberar métricas de API, fila e uptime.
            </div>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="glass-surface space-y-4 rounded-[var(--radius)] border border-border/60 px-5 py-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs uppercase tracking-wide text-muted-foreground">Ações pendentes</span>
                <h2 className="text-lg font-semibold text-white">Operações em aberto</h2>
              </div>
              <Button size="sm" variant="secondary" onClick={handleRefreshInstances}>
                Atualizar
              </Button>
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                {qrStatusMessage ?? 'Aguardando leitura do QR Code.'}
              </li>
              {countdownMessage ? (
                <li className="flex items-center gap-2 text-amber-200">
                  <Clock className="h-4 w-4" /> {countdownMessage}
                </li>
              ) : null}
              {!canContinue ? (
                <li className="flex items-center gap-2 text-muted-foreground">
                  <Shield className="h-4 w-4" /> Conclua o assistente para liberar a Inbox.
                </li>
              ) : (
                <li className="flex items-center gap-2 text-emerald-300">
                  <Check className="h-4 w-4" /> Tudo certo para avançar.
                </li>
              )}
            </ul>
          </div>
          <div className="glass-surface space-y-4 rounded-[var(--radius)] border border-border/60 px-5 py-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs uppercase tracking-wide text-muted-foreground">Histórico</span>
                <h2 className="text-lg font-semibold text-white">Logs recentes</h2>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setQrPanelOpen(true)}>
                Ver completo
              </Button>
            </div>
            {timelinePreview.length ? (
              <ul className="space-y-3 text-sm text-muted-foreground">
                {timelinePreview.map((item) => (
                  <li key={item.id ?? item.timestamp} className="rounded-xl border border-border/60 bg-surface-overlay-quiet p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {item.timestampLabel}
                    </p>
                    <p className="text-sm text-white">{item.title}</p>
                    {item.description ? <p className="text-xs text-muted-foreground">{item.description}</p> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum evento recente para mostrar.</p>
            )}
          </div>
        </div>

        <Suspense fallback={<SectionFallback />}>
          <AdvancedOperationsPanel
            surfaceStyles={surfaceStyles}
            open={qrPanelOpen}
            onOpenChange={(value) => setQrPanelOpen(value)}
            qrStatusMessage={qrStatusMessage}
            pairingPhoneInput={pairingPhoneInput}
            onPairingPhoneChange={handlePairingPhoneChange}
            pairingDisabled={!selectedInstance || requestingPairingCode || isBusy}
            requestingPairingCode={requestingPairingCode}
            onRequestPairingCode={handleRequestPairingCode}
            pairingPhoneError={pairingPhoneError}
            timelineItems={timelineItems}
            realtimeConnected={realtimeConnected}
          />
        </Suspense>
      </section>

      <footer className="flex flex-wrap items-center justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={onContinue} disabled={confirmDisabled}>
          {confirmDisabled ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
          {confirmLabel}
        </Button>
      </footer>

      <Suspense fallback={<DialogFallback />}>
        <CreateInstanceDialog open={isCreateInstanceOpen} onOpenChange={setCreateInstanceOpen} defaultName={defaultInstanceName} onSubmit={submitCreateInstance} />
      </Suspense>

      <Suspense fallback={<DialogFallback />}>
        <Dialog open={isQrDialogOpen} onOpenChange={setQrDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>QR Code ativo</DialogTitle>
              <DialogDescription>Escaneie com o aplicativo oficial para concluir a sincronização.</DialogDescription>
            </DialogHeader>
            <QrPreview
              src={qrImageSrc}
              statusMessage={qrStatusMessage}
              isGenerating={isGeneratingQrImage}
              onGenerate={handleGenerateQr}
              onOpen={() => setQrDialogOpen(true)}
              generateDisabled={isBusy}
              openDisabled={false}
              className="rounded-xl border border-dashed border-border/60 p-6"
              illustrationClassName={surfaceStyles.qrIllustration}
            />
          </DialogContent>
        </Dialog>
      </Suspense>

      <AlertDialog open={deletionDialog.open} onOpenChange={(value) => !value && setInstancePendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deletionDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>Confirme para remover {deletionDialog.targetLabel}.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setInstancePendingDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletionDialog.target && handleDeleteInstance(deletionDialog.target)}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deletionDialog.actionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {errorState ? (
        <div className="flex flex-wrap items-start gap-3 rounded-[var(--radius)] border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4" />
          <div className="flex-1 space-y-1">
            <p className="font-medium">{errorState.title ?? 'Algo deu errado'}</p>
            <p>{errorState.message}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button size="sm" variant="outline" onClick={() => void loadInstances({ forceRefresh: true })}>
              Tentar novamente
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default WhatsAppConnect;
