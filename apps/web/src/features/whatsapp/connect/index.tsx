import { Suspense, lazy, useMemo } from 'react';

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
import { AlertCircle, ArrowLeft, CheckCircle2, Clock, Loader2 } from 'lucide-react';

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

  const backLabel = 'Voltar';

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="glass-surface space-y-6 rounded-[var(--radius)] border border-[var(--border)] px-6 py-5 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-[color:var(--color-inbox-foreground-muted)]/80">
              <Badge variant="secondary">{stepLabel}</Badge>
              {nextStage ? <span>Próximo: {nextStage}</span> : null}
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-foreground">Conecte seu WhatsApp</h1>
              <p className="max-w-xl text-sm text-muted-foreground">{onboardingDescription}</p>
            </div>
            {onBack ? (
              <Button variant="ghost" size="sm" onClick={onBack} className="w-fit">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {backLabel}
              </Button>
            ) : null}
          </div>
          <div className="flex flex-col items-end gap-3 text-xs text-muted-foreground">
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
              <span className="text-[0.65rem] uppercase tracking-wide text-muted-foreground/80">
                {instancesCountLabel}
              </span>
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
        <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs uppercase tracking-wide text-[color:var(--color-inbox-foreground-muted)]/70">
            Status do canal
          </span>
          <span className="max-w-2xl text-sm text-muted-foreground">{copy.description}</span>
        </div>
      </header>

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
        />
      </Suspense>

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

      <footer className="flex flex-wrap items-center justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={onContinue} disabled={confirmDisabled}>
          {confirmDisabled ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
          {confirmLabel}
        </Button>
      </footer>

      <Suspense fallback={<DialogFallback />}>
        <CreateInstanceDialog
          open={isCreateInstanceOpen}
          onOpenChange={setCreateInstanceOpen}
          defaultName={defaultInstanceName}
          onSubmit={submitCreateInstance}
        />
      </Suspense>

      <Suspense fallback={<DialogFallback />}>
        <Dialog open={isQrDialogOpen} onOpenChange={setQrDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>QR Code ativo</DialogTitle>
              <DialogDescription>
                Escaneie com o aplicativo oficial para concluir a sincronização.
              </DialogDescription>
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
            <AlertDialogDescription>
              Confirme para remover {deletionDialog.targetLabel}.
            </AlertDialogDescription>
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
