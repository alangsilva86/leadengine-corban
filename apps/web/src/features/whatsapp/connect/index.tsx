import { Suspense, lazy } from 'react';

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
import NoticeBanner from '@/components/ui/notice-banner.jsx';
import { AlertCircle, AlertTriangle, ArrowLeft, CheckCircle2, Clock, Loader2 } from 'lucide-react';

import useWhatsAppConnect from './useWhatsAppConnect';

const InstancesPanel = lazy(() => import('../components/InstancesPanel.jsx'));
const CreateInstanceDialog = lazy(() => import('../components/CreateInstanceDialog.jsx'));
const CreateCampaignDialog = lazy(() => import('../components/CreateCampaignDialog.jsx'));
const ReassignCampaignDialog = lazy(() => import('../components/ReassignCampaignDialog.jsx'));
const QrPreview = lazy(() => import('../components/QrPreview.jsx'));
const CampaignManager = lazy(() => import('./CampaignManager'));
const QrFlow = lazy(() => import('./QrFlow'));

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
    createCampaign,
    updateCampaignStatus,
    deleteCampaign,
    reassignCampaign,
    campaigns,
    campaignsLoading,
    campaignError,
    campaignAction,
    campaign,
    persistentWarning,
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
    setCreateCampaignOpen,
    isCreateInstanceOpen,
    isCreateCampaignOpen,
    renderInstances,
    setPendingReassign,
    pendingReassign,
    setReassignIntent,
    reassignIntent,
    fetchCampaignImpact,
    agreementName,
    nextStage,
    stepLabel,
    onboardingDescription,
    reloadCampaigns,
  } = useWhatsAppConnect(props);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="glass-surface space-y-4 rounded-[var(--radius)] border border-[var(--border)] px-6 py-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-[color:var(--color-inbox-foreground-muted)]/80">
              <Badge variant="secondary">{stepLabel}</Badge>
              <span>Próximo: {nextStage}</span>
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Conecte seu WhatsApp</h1>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">{onboardingDescription}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 text-xs text-muted-foreground">
            <Badge variant="status" tone={statusTone as any} className="gap-2 text-xs font-medium">
              {statusCopy.badge}
            </Badge>
            <div className="flex flex-col items-end gap-1">
              <span>
                Convênio: <span className="font-medium text-foreground">{agreementDisplayName}</span>
              </span>
              {!hasAgreement ? (
                <span className="text-[0.7rem] text-muted-foreground/80">
                  Convênios e campanhas podem ser definidos depois — avance quando estiver pronto.
                </span>
              ) : null}
            </div>
            {countdownMessage ? (
              <span className="flex items-center gap-1 text-amber-200">
                <Clock className="h-3.5 w-3.5" />
                {countdownMessage}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" /> Voltar aos convênios
          </Button>
          <Separator className="section-divider flex-1" />
          <span>{copy.description}</span>
        </div>
      </header>

      {persistentWarning ? (
        <NoticeBanner tone="warning" icon={<AlertTriangle className="h-4 w-4" />}>
          <p>{persistentWarning}</p>
          <p className="text-xs text-amber-200/80">
            Os leads continuam chegando normalmente; campanhas ajudam apenas no roteamento avançado e podem ser criadas quando achar necessário.
          </p>
        </NoticeBanner>
      ) : null}

      <Suspense fallback={<SectionFallback />}>
        <InstancesPanel
          surfaceStyles={surfaceStyles}
          hasAgreement={hasAgreement}
          nextStage={nextStage}
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
          onToggleShowAll={() => setShowAllInstances(!showAllInstances)}
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
        <QrFlow
          surfaceStyles={surfaceStyles}
          open={qrPanelOpen}
          onOpenChange={(value) => setQrPanelOpen(value)}
          qrImageSrc={qrImageSrc}
          isGeneratingQrImage={isGeneratingQrImage}
          qrStatusMessage={qrStatusMessage}
          onGenerate={handleGenerateQr}
          onOpenQrDialog={() => setQrDialogOpen(true)}
          generateDisabled={!selectedInstance || isBusy}
          openDisabled={!selectedInstance}
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

      <Suspense fallback={<SectionFallback />}>
        <CampaignManager
          agreementName={agreementName ?? null}
          campaigns={campaigns}
          loading={campaignsLoading}
          error={campaignError}
          onRefresh={() => void reloadCampaigns()}
          onCreateClick={() => setCreateCampaignOpen(true)}
          onPause={(target) => void updateCampaignStatus(target, 'paused')}
          onActivate={(target) => void updateCampaignStatus(target, 'active')}
          onDelete={(target) => void deleteCampaign(target)}
          onReassign={(target) => {
            setPendingReassign(target);
            setReassignIntent('reassign');
          }}
          onDisconnect={(target) => {
            setPendingReassign(target);
            setReassignIntent('disconnect');
          }}
          actionState={campaignAction}
          selectedInstanceId={selectedInstance?.id ?? null}
          canCreateCampaigns={Boolean(hasAgreement)}
          selectedAgreementId={selectedAgreement?.id ?? null}
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
        <CreateCampaignDialog
          open={isCreateCampaignOpen}
          onOpenChange={setCreateCampaignOpen}
          agreement={selectedAgreement}
          instances={renderInstances}
          defaultInstanceId={selectedInstance?.id ?? undefined}
          onSubmit={createCampaign}
        />
      </Suspense>

      <Suspense fallback={<DialogFallback />}>
        <ReassignCampaignDialog
          open={Boolean(pendingReassign)}
          onClose={(value) => {
            if (!value) {
              setPendingReassign(null);
            }
          }}
          campaign={pendingReassign}
          instances={renderInstances}
          fetchImpact={fetchCampaignImpact}
          intent={reassignIntent}
          onSubmit={async ({ instanceId }) => {
            if (!pendingReassign) {
              return;
            }
            const targetInstance = reassignIntent === 'disconnect' ? null : instanceId ?? null;
            await reassignCampaign(pendingReassign, targetInstance);
            setPendingReassign(null);
          }}
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
