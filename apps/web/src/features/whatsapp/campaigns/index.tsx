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

const SectionFallback = () => (
  <Card className="border border-border/60 bg-surface-overlay-quiet p-6 text-sm text-muted-foreground">
    Carregando…
  </Card>
);

const DialogFallback = () => null;

type OnboardingStage = {
  id: string;
  label: string;
};

type WhatsAppCampaignsProps = Parameters<typeof useWhatsAppConnect>[0] & {
  onNavigateStage?: (stageId: string) => void;
};

const WhatsAppCampaigns = (props: WhatsAppCampaignsProps) => {
  const {
    statusCopy,
    statusTone,
    confirmLabel,
    confirmDisabled,
    onBack,
    onContinue,
    campaigns,
    campaignsLoading,
    campaignError,
    campaignAction,
    reloadCampaigns,
    updateCampaignStatus,
    deleteCampaign,
    reassignCampaign,
    canCreateCampaigns,
    selectedAgreement,
    selectedInstance,
    setCreateCampaignOpen,
    isCreateCampaignOpen,
    createCampaign,
    renderInstances,
    setPendingReassign,
    pendingReassign,
    setReassignIntent,
    reassignIntent,
    fetchCampaignImpact,
    agreementName,
    persistentWarning,
    nextStage,
    stepLabel,
    onboardingDescription,
    realtimeConnected,
    connectionStatus,
    connectionHealthy,
  } = useWhatsAppConnect(props);

  const backLabel = 'Voltar';
  const fallbackSteps = useMemo<OnboardingStage[]>(
    () => [
      { id: 'channels', label: 'Instâncias & Canais' },
      { id: 'campaigns', label: 'Campanhas' },
      { id: 'inbox', label: 'Inbox' },
    ],
    []
  );

  const resolvedSteps: OnboardingStage[] = props?.onboarding?.stages?.length
    ? (props.onboarding.stages as OnboardingStage[])
    : fallbackSteps;
  const activeStepIndex = props?.onboarding?.activeStep ?? 1;
  const currentStage = resolvedSteps[activeStepIndex] ?? resolvedSteps[1] ?? resolvedSteps[0];
  const stageObjectives: Record<string, string> = {
    channels: 'Conecte instância',
    campaigns: 'Configure campanha',
    inbox: 'Revise roteamento',
  };
  const objectiveCopy = stageObjectives[currentStage?.id ?? ''] ?? 'Avance na jornada de integração';
  const supportCopy = `${objectiveCopy}. ${onboardingDescription}`;

  const hasCampaigns = (campaigns?.length ?? 0) > 0;
  const primaryAction = hasCampaigns ? 'continue' : 'create';
  const primaryLabel = hasCampaigns ? confirmLabel ?? 'Continuar' : 'Criar campanha';
  const isPrimaryDisabled = hasCampaigns ? confirmDisabled || !connectionHealthy : !connectionHealthy;

  const connectionBlockedMessage = connectionHealthy
    ? null
    : realtimeConnected
      ? 'Conecte uma instância ativa e com tempo real para gerenciar as campanhas.'
      : 'Tempo real está offline. Reative a conexão para gerenciar as campanhas.';

  const realtimeWarningMessage =
    connectionHealthy && !realtimeConnected
      ? 'Tempo real está offline. Você ainda pode criar ou ajustar campanhas, mas métricas instantâneas ficarão indisponíveis até restabelecer a conexão.'
      : null;

  const statusBadgeTone = connectionHealthy && realtimeConnected ? statusTone : 'warning';
  const statusBadgeLabel = connectionHealthy
    ? realtimeConnected
      ? statusCopy.badge
      : 'Tempo real offline'
    : 'Desconectado';

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

  const handleStageNavigate = (stageId: string, index: number) => {
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

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-4 rounded-[var(--radius)] border border-[var(--border)] bg-surface-overlay-strong px-6 py-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <Badge variant="secondary">{stepLabel}</Badge>
              <span className="font-semibold text-foreground/80">{objectiveCopy}</span>
              {nextStage ? <span className="text-[color:var(--color-inbox-foreground-muted)]">Próximo: {nextStage}</span> : null}
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Gerencie suas campanhas</h1>
              <p className="max-w-2xl text-sm text-muted-foreground">{supportCopy}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {selectedInstance ? (
              <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-200">
                Instância ativa · {selectedInstance.name ?? selectedInstance.id}
              </Badge>
            ) : null}
            <Badge variant="status" tone={statusBadgeTone as any} className="gap-2 text-xs font-medium uppercase">
              {statusBadgeLabel}
            </Badge>
          </div>
        </div>
        <Separator className="section-divider" />
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2 text-sm">
            {resolvedSteps.map((step: OnboardingStage, index: number) => {
              const status = index < activeStepIndex ? 'done' : index === activeStepIndex ? 'current' : 'todo';

              return (
                <button
                  type="button"
                  key={step.id}
                  onClick={() => handleStageNavigate(step.id, index)}
                  className={cn(
                    'group inline-flex items-center gap-2 rounded-full border px-3 py-1.5 transition',
                    'hover:border-primary/50 hover:text-primary',
                    status === 'done' && 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700',
                    status === 'current' && 'border-primary/50 bg-primary/15 text-primary',
                    status === 'todo' && 'border-border/70 text-muted-foreground'
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex h-6 w-6 items-center justify-center rounded-full border text-[0.7rem] font-semibold transition',
                      status === 'done' && 'border-emerald-500/60 bg-emerald-500/15 text-emerald-700',
                      status === 'current' && 'border-primary/60 bg-primary/20 text-primary',
                      status === 'todo' && 'border-border/60 bg-background text-muted-foreground'
                    )}
                  >
                    {status === 'done' ? <Check className="h-3.5 w-3.5" /> : index + 1}
                  </span>
                  <span className="text-sm font-medium leading-none">{step.label}</span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onBack ? (
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {backLabel}
              </Button>
            ) : null}
            <Button size="sm" onClick={handlePrimaryAction} disabled={isPrimaryDisabled}>
              {isPrimaryDisabled && primaryAction === 'continue' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              {primaryLabel}
            </Button>
          </div>
        </div>
      </header>

      {connectionBlockedMessage ? (
        <NoticeBanner tone="warning" icon={<AlertTriangle className="h-4 w-4" />}>
          {connectionBlockedMessage}
        </NoticeBanner>
      ) : null}

      {realtimeWarningMessage ? (
        <NoticeBanner tone="warning" icon={<AlertTriangle className="h-4 w-4" />}>
          {realtimeWarningMessage}
        </NoticeBanner>
      ) : null}

      {persistentWarning ? (
        <NoticeBanner tone="warning" icon={<AlertTriangle className="h-4 w-4" />}>
          <p>{persistentWarning}</p>
          <p className="text-xs text-amber-200/80">
            Os leads continuam chegando normalmente; campanhas ajudam apenas no roteamento avançado e podem ser criadas quando achar necessário.
          </p>
        </NoticeBanner>
      ) : null}

      <Suspense fallback={<SectionFallback />}>
        <CampaignsPanel
          agreementName={agreementName ?? undefined}
          campaigns={campaigns}
          loading={campaignsLoading}
          error={campaignError}
          onRefresh={() => void reloadCampaigns()}
          onCreateClick={() => setCreateCampaignOpen(true)}
          onPause={(target: any) => void updateCampaignStatus(target, 'paused')}
          onActivate={(target: any) => void updateCampaignStatus(target, 'active')}
          onDelete={(target: any) => void deleteCampaign(target)}
          onReassign={(target: any) => {
            setPendingReassign(target);
            setReassignIntent('reassign');
          }}
          onDisconnect={(target: any) => {
            setPendingReassign(target);
            setReassignIntent('disconnect');
          }}
          actionState={campaignAction}
          selectedInstanceId={selectedInstance?.id ?? null}
          canCreateCampaigns={canCreateCampaigns}
          selectedAgreementId={selectedAgreement?.id ?? null}
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
          onClose={(value: boolean) => {
            if (!value) {
              setPendingReassign(null);
            }
          }}
          campaign={pendingReassign}
          instances={renderInstances}
          fetchImpact={fetchCampaignImpact}
          intent={reassignIntent}
          onSubmit={async ({ instanceId }: { instanceId?: string | null }) => {
            if (!pendingReassign) {
              return;
            }
            const targetInstance = reassignIntent === 'disconnect' ? null : instanceId ?? null;
            await reassignCampaign(pendingReassign, targetInstance);
            setPendingReassign(null);
          }}
        />
      </Suspense>
    </div>
  );
};

export default WhatsAppCampaigns;
