import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import {
  ArrowLeft,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils.js';
import { toDataURL as generateQrDataUrl } from 'qrcode';
import usePlayfulLogger from '../shared/usePlayfulLogger.js';
import useOnboardingStepLabel from '../onboarding/useOnboardingStepLabel.js';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible.jsx';
import useWhatsAppCampaigns from './hooks/useWhatsAppCampaigns.js';
import useWhatsAppInstances from './hooks/useWhatsAppInstances.js';
import NoticeBanner from '@/components/ui/notice-banner.jsx';
import CampaignsPanel from './components/CampaignsPanel.jsx';
import CreateCampaignDialog from './components/CreateCampaignDialog.jsx';
import CreateInstanceDialog from './components/CreateInstanceDialog.jsx';
import ReassignCampaignDialog from './components/ReassignCampaignDialog.jsx';
import QrPreview from './components/QrPreview.jsx';
import InstancesPanel from './components/InstancesPanel.jsx';
import QrSection from './components/QrSection.jsx';
import { toast } from 'sonner';
import { resolveWhatsAppErrorCopy } from './utils/whatsapp-error-codes.js';
import { getInstanceMetrics } from './utils/metrics.js';
import {
  formatMetricValue,
  formatPhoneNumber,
  formatTimestampLabel,
  humanizeLabel,
} from './utils/formatting.js';
import { getQrImageSrc } from './utils/qr.js';

const STATUS_TONES = {
  disconnected: 'warning',
  connecting: 'info',
  connected: 'success',
  qr_required: 'warning',
  fallback: 'neutral',
};

const SURFACE_COLOR_UTILS = {
  instancesPanel: 'border border-border/60 bg-surface-overlay-strong',
  qrInstructionsPanel: 'border border-border/60 bg-surface-overlay-quiet',
  glassTile: 'border border-surface-overlay-glass-border bg-surface-overlay-glass',
  glassTileDashed: 'border border-dashed border-surface-overlay-glass-border bg-surface-overlay-glass',
  glassTileActive: 'border-primary/60 bg-primary/10 ring-1 ring-primary/40 shadow-sm',
  glassTileIdle: 'border-surface-overlay-glass-border bg-surface-overlay-glass hover:border-primary/30',
  destructiveBanner: 'border border-destructive/40 bg-destructive/10 text-destructive',
  qrIllustration: 'border-surface-overlay-glass-border bg-surface-overlay-glass text-primary shadow-inner',
  progressTrack: 'bg-surface-overlay-glass',
  progressIndicator: 'bg-primary',
};

const statusCopy = {
  disconnected: {
    badge: 'Pendente',
    description: 'Leia o QR Code no WhatsApp Web para conectar seu número e começar a receber leads.',
    tone: STATUS_TONES.disconnected,
  },
  connecting: {
    badge: 'Conectando',
    description: 'Estamos sincronizando com o seu número. Mantenha o WhatsApp aberto até concluir.',
    tone: STATUS_TONES.connecting,
  },
  connected: {
    badge: 'Ativo',
    description: 'Pronto! Todos os leads qualificados serão entregues diretamente no seu WhatsApp.',
    tone: STATUS_TONES.connected,
  },
  qr_required: {
    badge: 'QR necessário',
    description: 'Gere um novo QR Code e escaneie para reativar a sessão.',
    tone: STATUS_TONES.qr_required,
  },
};

const statusCodeMeta = [
  { code: '1', label: '1', description: 'Total de mensagens reportadas com o código 1 pelo broker.' },
  { code: '2', label: '2', description: 'Total de mensagens reportadas com o código 2 pelo broker.' },
  { code: '3', label: '3', description: 'Total de mensagens reportadas com o código 3 pelo broker.' },
  { code: '4', label: '4', description: 'Total de mensagens reportadas com o código 4 pelo broker.' },
  { code: '5', label: '5', description: 'Total de mensagens reportadas com o código 5 pelo broker.' },
];

const DEFAULT_POLL_INTERVAL_MS = 15000;
const RATE_LIMIT_COOLDOWN_MS = 60 * 1000;











const getStatusInfo = (instance) => {
  const rawStatus = instance?.status || (instance?.connected ? 'connected' : 'disconnected');
  const map = {
    connected: { label: 'Conectado', variant: 'success' },
    connecting: { label: 'Conectando', variant: 'info' },
    disconnected: { label: 'Desconectado', variant: 'secondary' },
    qr_required: { label: 'QR necessário', variant: 'warning' },
    error: { label: 'Erro', variant: 'destructive' },
  };
  return map[rawStatus] || { label: rawStatus || 'Indefinido', variant: 'secondary' };
};







const useQrImageSource = (qrPayload) => {
  const qrMeta = useMemo(() => getQrImageSrc(qrPayload), [qrPayload]);
  const { code, immediate, needsGeneration } = qrMeta;
  const [src, setSrc] = useState(immediate ?? null);
  const [isGenerating, setIsGenerating] = useState(Boolean(needsGeneration && !immediate));

  useEffect(() => {
    let cancelled = false;

    if (immediate) {
      setSrc(immediate);
      setIsGenerating(false);
      return () => {
        cancelled = true;
      };
    }

    if (!code || !needsGeneration) {
      setSrc(null);
      setIsGenerating(false);
      return () => {
        cancelled = true;
      };
    }

    setSrc(null);
    setIsGenerating(true);
    generateQrDataUrl(code, { type: 'image/png', errorCorrectionLevel: 'M', margin: 1 })
      .then((url) => {
        if (!cancelled) {
          setSrc(url);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('Falha ao gerar QR Code', error);
          setSrc(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsGenerating(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [code, immediate, needsGeneration]);

  return { src, isGenerating };
};


const looksLikeWhatsAppJid = (value) =>
  typeof value === 'string' && value.toLowerCase().endsWith('@s.whatsapp.net');


const resolveInstancePhone = (instance) =>
  instance?.phoneNumber ||
  instance?.number ||
  instance?.msisdn ||
  instance?.metadata?.phoneNumber ||
  instance?.metadata?.phone_number ||
  instance?.metadata?.msisdn ||
  instance?.jid ||
  instance?.session ||
  '';










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
  const { log, warn, error: logError } = usePlayfulLogger('🎯 LeadEngine • WhatsApp');
  const clearCampaignSelectionRef = useRef(() => {});
  const authFallbackBridgeRef = useRef(() => {});

  const forwardClearCampaignSelection = useCallback(() => {
    clearCampaignSelectionRef.current?.();
  }, []);

  const forwardAuthFallback = useCallback((payload) => {
    authFallbackBridgeRef.current?.(payload);
  }, []);

  const isAuthError = useCallback((error) => {
    const responseStatus = typeof error?.status === 'number' ? error.status : null;
    return responseStatus === 401 || responseStatus === 403;
  }, []);

  const [campaignForInstances, setCampaignForInstances] = useState(activeCampaign ?? null);

  const {
    state: instanceState,
    actions: instanceActions,
    helpers: instanceHelpers,
  } = useWhatsAppInstances({
    agreement: selectedAgreement,
    activeCampaign: campaignForInstances,
    onStatusChange,
    onAuthFallback: forwardAuthFallback,
    toast,
    logger: { log, warn, error: logError },
    formatters: {
      resolveWhatsAppErrorCopy,
      formatMetricValue,
      formatTimestampLabel,
      formatPhoneNumber,
      humanizeLabel,
      getInstanceMetrics,
    },
    campaignHelpers: {
      clearCampaignSelection: forwardClearCampaignSelection,
    },
    status,
  });

  authFallbackBridgeRef.current = instanceActions.handleAuthFallback;

  const {
    instances,
    instance,
    instancesReady,
    showAllInstances,
    qrData,
    secondsLeft,
    loadingInstances,
    loadingQr,
    pairingPhoneInput,
    pairingPhoneError,
    requestingPairingCode,
    sessionActive,
    authDeferred,
    authTokenState,
    errorState,
    localStatus,
    qrPanelOpen,
    isQrDialogOpen,
    deletingInstanceId,
    instancePendingDelete,
    timelineItems,
    realtimeConnected,
  } = instanceState;

  const {
    setShowAllInstances,
    setQrPanelOpen,
    setQrDialogOpen,
    setInstancePendingDelete,
    setDeletingInstanceId,
    setInstance,
    loadInstances,
    connectInstance,
    generateQr,
    handleInstanceSelect,
    handleViewQr,
    submitCreateInstance,
    handleDeleteInstance,
    handleMarkConnected,
    handlePairingPhoneChange,
    handleRequestPairingCode,
    setQrImageGenerating,
    handleAuthFallback,
    clearError,
  } = instanceActions;

  const {
    shouldDisplayInstance,
    resolveInstancePhone,
    formatMetricValue: formatMetricValueHelper,
    formatTimestampLabel: formatTimestampLabelHelper,
    formatPhoneNumber: formatPhoneNumberHelper,
    humanizeLabel: humanizeLabelHelper,
    getInstanceMetrics: getInstanceMetricsHelper,
  } = instanceHelpers;

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
    instance: instanceState.instance,
    instances: instanceState.instances,
    activeCampaign,
    onCampaignReady,
    isAuthError,
    onAuthError: forwardAuthFallback,
    onSuccess: (message, options) => toast.success(message, options),
    onError: (message, options) => toast.error(message, options),
    warn,
    logError,
  });

  clearCampaignSelectionRef.current = clearCampaignSelection;

  useEffect(() => {
    setCampaignForInstances(campaign ?? activeCampaign ?? null);
  }, [campaign, activeCampaign]);

  const [isCreateInstanceOpen, setCreateInstanceOpen] = useState(false);
  const [isCreateCampaignOpen, setCreateCampaignOpen] = useState(false);
  const [pendingReassign, setPendingReassign] = useState(null);
  const [reassignIntent, setReassignIntent] = useState('reassign');

  const copy = statusCopy[localStatus] ?? statusCopy.disconnected;

  const { stepLabel, nextStage } = useOnboardingStepLabel({
    stages: onboarding?.stages,
    targetStageId: 'whatsapp',
    fallbackStep: { number: 3, label: 'Passo 3', nextStage: 'Inbox de Leads' },
  });
  const hasAgreement = Boolean(selectedAgreement?.id);
  const agreementName = selectedAgreement?.name ?? null;
  const agreementDisplayName = agreementName ?? 'Nenhum convênio selecionado';
  const hasCampaign = Boolean(campaign);
  const { src: qrImageSrc, isGenerating: isGeneratingQrImage } = useQrImageSource(qrData);
  const hasQr = Boolean(qrImageSrc);
  const canSynchronize = sessionActive && !authDeferred;
  const isAuthenticated = canSynchronize && Boolean(authTokenState);
  const canContinue = localStatus === 'connected' && Boolean(instance);
  const statusTone = copy.tone || STATUS_TONES.fallback;
  const countdownMessage = secondsLeft !== null ? `QR expira em ${secondsLeft}s` : null;
  const isBusy = loadingInstances || loadingQr || isGeneratingQrImage || requestingPairingCode;
  const confirmLabel = 'Ir para a inbox de leads';
  const confirmDisabled = !canContinue || isBusy;
  const qrStatusMessage = localStatus === 'connected'
    ? 'Conexão ativa — QR oculto.'
    : countdownMessage || (loadingQr || isGeneratingQrImage ? 'Gerando QR Code…' : 'Selecione uma instância para gerar o QR.');
  const selectedInstanceStatusInfo = instance ? getStatusInfo(instance) : null;
  const selectedInstancePhone = instance ? resolveInstancePhone(instance) : '';
  const onboardingDescription = hasAgreement
    ? 'Utilize o QR Code para sincronizar o número que você usa com os clientes. Após a conexão, o Lead Engine entrega automaticamente os leads do convênio selecionado. Campanhas são opcionais e podem ser configuradas quando precisar de roteamento avançado.'
    : 'Utilize o QR Code para sincronizar o número que você usa com os clientes. Você pode vincular um convênio quando for conveniente e criar campanhas opcionais apenas se precisar de roteamento avançado.';
  const nextInstanceOrdinal = instances.length + 1;
  const defaultInstanceName = hasAgreement && agreementName
    ? `${agreementName} • WhatsApp ${nextInstanceOrdinal}`
    : `Instância WhatsApp ${nextInstanceOrdinal}`;
  const visibleInstances = useMemo(() => instances.filter(shouldDisplayInstance), [instances]);
  const totalInstanceCount = instances.length;
  const visibleInstanceCount = visibleInstances.length;
  const hasHiddenInstances = totalInstanceCount > visibleInstanceCount;
  const renderInstances = showAllInstances ? instances : visibleInstances;
  const instancesCountLabel = instancesReady
    ? showAllInstances
      ? `${totalInstanceCount} instância(s)`
      : `${visibleInstanceCount} ativa(s)`
    : 'Sincronizando…';
  const hasRenderableInstances = renderInstances.length > 0;
  const showFilterNotice = instancesReady && hasHiddenInstances && !showAllInstances;

  useEffect(() => {
    setQrImageGenerating(isGeneratingQrImage);
  }, [isGeneratingQrImage, setQrImageGenerating]);

  const handleRefreshInstances = useCallback(() => {
    void loadInstances({ forceRefresh: true });
  }, [loadInstances]);
  const handleGenerateQrClick = useCallback(async () => {
    if (!instance?.id) return;
    await generateQr(instance.id);
  }, [generateQr, instance?.id]);

  const handleViewQrDialog = useCallback(
    async (inst) => {
      await handleViewQr(inst);
    },
    [handleViewQr]
  );

  const handleCreateInstanceOpen = useCallback(() => {
    clearError();
    setCreateInstanceOpen(true);
  }, [clearError]);


  const handleConfirm = () => {
    if (!canContinue) {
      return;
    }
    onContinue?.();
  };

  const removalTargetLabel =
    instancePendingDelete?.name ||
    instancePendingDelete?.displayId ||
    instancePendingDelete?.id ||
    'selecionada';
  const removalTargetIsJid = instancePendingDelete?.id
    ? looksLikeWhatsAppJid(instancePendingDelete.id)
    : false;
  const removalDialogTitle = removalTargetIsJid ? 'Desconectar sessão' : 'Remover instância';
  const removalDialogAction = removalTargetIsJid ? 'Desconectar sessão' : 'Remover instância';

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
          surfaceStyles={SURFACE_COLOR_UTILS}
          hasAgreement={hasAgreement}
          nextStage={nextStage}
          agreementDisplayName={agreementDisplayName}
          selectedAgreementRegion={selectedAgreement?.region ?? null}
          selectedAgreementId={selectedAgreement?.id}
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
          onMarkConnected={() => void handleMarkConnected()}
          onRefresh={() => void handleRefreshInstances()}
          onCreateInstance={() => void handleCreateInstanceOpen()}
          onToggleShowAll={() => setShowAllInstances((current) => !current)}
          onShowAll={() => setShowAllInstances(true)}
          onRetry={() => void loadInstances({ forceRefresh: true })}
          onSelectInstance={(item) => void handleInstanceSelect(item)}
          onViewQr={(item) => void handleViewQrDialog(item)}
          onRequestDelete={(item) => setInstancePendingDelete(item)}
          deletingInstanceId={deletingInstanceId}
          statusCodeMeta={statusCodeMeta}
          getStatusInfo={getStatusInfo}
          getInstanceMetrics={getInstanceMetricsHelper}
          formatMetricValue={formatMetricValueHelper}
          resolveInstancePhone={resolveInstancePhone}
          formatPhoneNumber={formatPhoneNumberHelper}
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
          surfaceStyles={SURFACE_COLOR_UTILS}
          open={qrPanelOpen}
          onOpenChange={setQrPanelOpen}
          qrImageSrc={qrImageSrc}
          isGeneratingQrImage={isGeneratingQrImage}
          qrStatusMessage={qrStatusMessage}
          onGenerate={handleGenerateQrClick}
          onOpenQrDialog={() => setQrDialogOpen(true)}
          generateDisabled={isBusy || !instance || !isAuthenticated}
          openDisabled={!hasQr}
          pairingPhoneInput={pairingPhoneInput}
          onPairingPhoneChange={handlePairingPhoneChange}
          pairingDisabled={isBusy || !instance || !isAuthenticated}
          requestingPairingCode={requestingPairingCode}
          onRequestPairingCode={() => void handleRequestPairingCode()}
          pairingPhoneError={pairingPhoneError}
          timelineItems={timelineItems}
          realtimeConnected={realtimeConnected}
          humanizeLabel={humanizeLabelHelper}
          formatPhoneNumber={formatPhoneNumberHelper}
          formatTimestampLabel={formatTimestampLabelHelper}
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
                Esta ação desconecta a sessão <strong>{removalTargetLabel}</strong>. Utilize quando precisar encerrar um
                dispositivo sincronizado com o broker.
              </>
            ) : (
              <>
                Esta ação remove permanentemente a instância <strong>{removalTargetLabel}</strong>. Verifique se não há
                campanhas ativas utilizando este número.
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

      <Dialog open={isQrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Escaneie o QR Code</DialogTitle>
            <DialogDescription>
              Use o aplicativo do WhatsApp para escanear o código abaixo e vincular esta instância com o LeadEngine.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            <QrPreview
              illustrationClassName={SURFACE_COLOR_UTILS.qrIllustration}
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
