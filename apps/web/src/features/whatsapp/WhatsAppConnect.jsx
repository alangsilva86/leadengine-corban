import { useCallback, useEffect } from 'react';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Separator } from '@/components/ui/separator.jsx';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx';
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
import { ArrowLeft, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

import useWhatsAppInstances from './hooks/useWhatsAppInstances.js';
import useWhatsAppCampaigns from './hooks/useWhatsAppCampaigns.js';
import NoticeBanner from '@/components/ui/notice-banner.jsx';
import CampaignsPanel from './components/CampaignsPanel.jsx';
import CreateCampaignDialog from './components/CreateCampaignDialog.jsx';
import CreateInstanceDialog from './components/CreateInstanceDialog.jsx';
import ReassignCampaignDialog from './components/ReassignCampaignDialog.jsx';
import QrPreview from './components/QrPreview.jsx';
import InstancesPanel from './components/InstancesPanel.jsx';
import QrSection from './components/QrSection.jsx';

const WhatsAppConnect = ({
  selectedAgreement,
  status = 'disconnected',
  activeCampaign,
  onboarding,
  onStatusChange,
  onCampaignReady,
  onContinue,
  onBack,
}) => {
  const {
    warn,
    logError,
    surfaceStyles,
    statusCodeMeta,
    getStatusInfo,
    getInstanceMetrics,
    formatMetricValue,
    formatPhoneNumber,
    formatTimestampLabel,
    humanizeLabel,
    resolveInstancePhone,
    statusTone,
    copy,
    stepLabel,
    nextStage,
    onboardingDescription,
    hasAgreement,
    agreementDisplayName,
    agreementRegion,
    agreementId,
    countdownMessage,
    confirmLabel,
    confirmDisabled,
    qrStatusMessage,
    qrPanelOpen,
    setQrPanelOpen,
    qrImageSrc,
    isGeneratingQrImage,
    hasQr,
    isAuthenticated,
    isBusy,
    instance,
    instances,
    instancesReady,
    hasHiddenInstances,
    hasRenderableInstances,
    renderInstances,
    showFilterNotice,
    showAllInstances,
    setShowAllInstances,
    instancesCountLabel,
    errorState,
    loadingInstances,
    localStatus,
    handleMarkConnected,
    handleRefreshInstances,
    handleCreateInstance,
    loadInstances,
    handleInstanceSelect,
    setInstancePendingDelete,
    instancePendingDelete,
    deletingInstanceId,
    handleDeleteInstance,
    submitCreateInstance,
    isCreateInstanceOpen,
    setCreateInstanceOpen,
    defaultInstanceName,
    isCreateCampaignOpen,
    setCreateCampaignOpen,
    pendingReassign,
    setPendingReassign,
    reassignIntent,
    setReassignIntent,
    removalTargetLabel,
    removalTargetIsJid,
    removalDialogTitle,
    removalDialogAction,
    qrImageModalOpen,
    setQrDialogOpen,
    timelineItems,
    realtimeConnected,
    pairingPhoneInput,
    handlePairingPhoneChange,
    pairingPhoneError,
    requestingPairingCode,
    handleRequestPairingCode,
    handleAuthFallback,
    isAuthError,
    syncCampaignSelection,
    generateQr,
    generateQrForInstance,
    resetQrState,
    canContinue,
  } = useWhatsAppInstances({
    agreement: selectedAgreement,
    status,
    onboarding,
    activeCampaign,
    onStatusChange,
  });

  const {
    campaign,
    campaigns,
    campaignsLoading,
    campaignError,
    campaignAction,
    persistentWarning,
    loadCampaigns,
    createCampaign,
    updateCampaignStatus,
    deleteCampaign,
    reassignCampaign,
    fetchCampaignImpact,
    clearCampaignSelection,
  } = useWhatsAppCampaigns({
    agreement: selectedAgreement,
    instance,
    instances,
    activeCampaign,
    onCampaignReady,
    isAuthError,
    onAuthError: handleAuthFallback,
    onSuccess: (message, options) => toast.success(message, options),
    onError: (message, options) => toast.error(message, options),
    warn,
    logError,
  });

  useEffect(() => {
    if (campaign) {
      syncCampaignSelection(campaign);
    }
  }, [campaign, syncCampaignSelection]);

  const hasCampaign = Boolean(campaign);
  const selectedInstanceStatusInfo = instance ? getStatusInfo(instance) : null;
  const selectedInstancePhone = instance ? resolveInstancePhone(instance) : '';
  const pairingDisabled = isBusy || !instance || !isAuthenticated;

  const handleConfirm = useCallback(() => {
    if (!canContinue) {
      return;
    }
    onContinue?.();
  }, [canContinue, onContinue]);

  const handleSelectInstance = useCallback(
    async (item, { skipAutoQr = false } = {}) => {
      if (!item) {
        return;
      }

      handleInstanceSelect(item);

      if (campaign && campaign.instanceId && campaign.instanceId !== item.id) {
        clearCampaignSelection();
      }

      if (skipAutoQr) {
        return;
      }

      if (item.status !== 'connected') {
        await generateQrForInstance(item.id, { skipStatus: false });
      } else {
        resetQrState();
      }
    },
    [campaign, clearCampaignSelection, generateQrForInstance, handleInstanceSelect, resetQrState]
  );

  const handleViewQrInstance = useCallback(
    async (item) => {
      if (!item) {
        return;
      }

      await handleSelectInstance(item, { skipAutoQr: true });
      await generateQrForInstance(item.id, { skipStatus: true });
      setQrDialogOpen(true);
    },
    [generateQrForInstance, handleSelectInstance, setQrDialogOpen]
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="glass-surface space-y-4 rounded-[var(--radius)] border border-[var(--border)] px-6 py-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-slate-300/80">
              <Badge variant="secondary">{stepLabel}</Badge>
              <span>Próximo: {nextStage}</span>
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Conecte seu WhatsApp</h1>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">{onboardingDescription}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 text-xs text-muted-foreground">
            <Badge variant="status" tone={statusTone} className="gap-2 text-xs font-medium">
              {copy.badge}
            </Badge>
            <div className="flex flex-col items-end gap-1">
              <span>
                Convênio:{' '}
                <span className="font-medium text-foreground">{agreementDisplayName}</span>
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

      <div className="space-y-6">
        <InstancesPanel
          surfaceStyles={surfaceStyles}
          hasAgreement={hasAgreement}
          nextStage={nextStage}
          agreementDisplayName={agreementDisplayName}
          selectedAgreementRegion={agreementRegion}
          selectedAgreementId={agreementId}
          selectedInstance={instance}
          selectedInstanceStatusInfo={selectedInstanceStatusInfo}
          selectedInstancePhone={selectedInstancePhone}
          hasCampaign={hasCampaign}
          campaign={campaign}
          instancesReady={instancesReady}
          hasHiddenInstances={hasHiddenInstances}
          hasRenderableInstances={hasRenderableInstances}
          renderInstances={renderInstances}
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
          onConfirm={() => void handleConfirm()}
          onMarkConnected={handleMarkConnected}
          onRefresh={() => void handleRefreshInstances()}
          onCreateInstance={() => void handleCreateInstance()}
          onToggleShowAll={() => setShowAllInstances((current) => !current)}
          onShowAll={() => setShowAllInstances(true)}
          onRetry={() => void loadInstances({ forceRefresh: true })}
          onSelectInstance={(item) => void handleSelectInstance(item)}
          onViewQr={(item) => void handleViewQrInstance(item)}
          onRequestDelete={(item) => setInstancePendingDelete(item)}
          deletingInstanceId={deletingInstanceId}
          statusCodeMeta={statusCodeMeta}
          getStatusInfo={getStatusInfo}
          getInstanceMetrics={getInstanceMetrics}
          formatMetricValue={formatMetricValue}
          resolveInstancePhone={resolveInstancePhone}
          formatPhoneNumber={formatPhoneNumber}
        />
        <CampaignsPanel
          agreementName={selectedAgreement?.name ?? null}
          campaigns={campaigns}
          loading={campaignsLoading}
          error={campaignError}
          onRefresh={() =>
            void loadCampaigns({
              preferredAgreementId: selectedAgreement?.id ?? null,
              preferredCampaignId: campaign?.id ?? null,
              preferredInstanceId: instance?.id ?? null,
            })
          }
          onCreateClick={() => setCreateCampaignOpen(true)}
          onPause={(entry) => void updateCampaignStatus(entry, 'paused')}
          onActivate={(entry) => void updateCampaignStatus(entry, 'active')}
          onDelete={(entry) => void deleteCampaign(entry)}
          onReassign={(entry) => {
            setReassignIntent('reassign');
            setPendingReassign(entry);
          }}
          onDisconnect={(entry) => {
            setReassignIntent('disconnect');
            setPendingReassign(entry);
          }}
          actionState={campaignAction}
          selectedInstanceId={instance?.id ?? null}
          canCreateCampaigns={hasAgreement}
          selectedAgreementId={selectedAgreement?.id ?? null}
        />
        <QrSection
          surfaceStyles={surfaceStyles}
          open={qrPanelOpen}
          onOpenChange={setQrPanelOpen}
          qrImageSrc={qrImageSrc}
          isGeneratingQrImage={isGeneratingQrImage}
          qrStatusMessage={qrStatusMessage}
          onGenerate={generateQr}
          onOpenQrDialog={() => setQrDialogOpen(true)}
          generateDisabled={isBusy || !instance || !isAuthenticated}
          openDisabled={!hasQr}
          pairingPhoneInput={pairingPhoneInput}
          onPairingPhoneChange={handlePairingPhoneChange}
          pairingDisabled={pairingDisabled}
          requestingPairingCode={requestingPairingCode}
          onRequestPairingCode={() => void handleRequestPairingCode()}
          pairingPhoneError={pairingPhoneError}
          timelineItems={timelineItems}
          realtimeConnected={realtimeConnected}
          humanizeLabel={humanizeLabel}
          formatPhoneNumber={formatPhoneNumber}
          formatTimestampLabel={formatTimestampLabel}
        />
      </div>

      <CreateInstanceDialog
        open={isCreateInstanceOpen}
        onOpenChange={setCreateInstanceOpen}
        defaultName={defaultInstanceName}
        onSubmit={async (payload) => {
          await submitCreateInstance(payload);
        }}
      />

      <CreateCampaignDialog
        open={isCreateCampaignOpen}
        onOpenChange={setCreateCampaignOpen}
        agreement={selectedAgreement}
        instances={instances}
        defaultInstanceId={instance?.id ?? null}
        onSubmit={async (payload) => {
          await createCampaign(payload);
        }}
      />

      <ReassignCampaignDialog
        open={Boolean(pendingReassign)}
        campaign={pendingReassign}
        instances={instances}
        intent={reassignIntent}
        onClose={(open) => {
          if (!open) {
            setPendingReassign(null);
            setReassignIntent('reassign');
          }
        }}
        onSubmit={async ({ instanceId }) => {
          if (!pendingReassign) {
            return;
          }
          await reassignCampaign(pendingReassign, instanceId);
          setPendingReassign(null);
          setReassignIntent('reassign');
        }}
        fetchImpact={fetchCampaignImpact}
      />

      <AlertDialog
        open={Boolean(instancePendingDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setInstancePendingDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{removalDialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {removalTargetIsJid ? (
                <>
                  Esta ação desconecta a sessão <strong>{removalTargetLabel}</strong>. Utilize quando precisar encerrar um dispositivo sincronizado com o broker.
                </>
              ) : (
                <>
                  Esta ação remove permanentemente a instância <strong>{removalTargetLabel}</strong>. Verifique se não há campanhas ativas utilizando este número.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setInstancePendingDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!instancePendingDelete) return;
                await handleDeleteInstance(instancePendingDelete);
                setInstancePendingDelete(null);
              }}
            >
              {removalDialogAction}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={qrImageModalOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Escaneie o QR Code</DialogTitle>
            <DialogDescription>
              Use o aplicativo do WhatsApp para escanear o código abaixo e vincular esta instância com o LeadEngine.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            <QrPreview
              illustrationClassName={surfaceStyles.qrIllustration}
              src={qrImageSrc}
              isGenerating={isGeneratingQrImage}
              size={64}
            />
            <p className="text-center text-sm text-muted-foreground">
              Abra o WhatsApp &gt; Configurações &gt; Dispositivos Conectados &gt; Conectar dispositivo e escaneie o QR Code exibido.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WhatsAppConnect;
