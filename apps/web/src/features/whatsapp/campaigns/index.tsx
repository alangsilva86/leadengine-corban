import { Suspense, lazy } from 'react';

import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card } from '@/components/ui/card.jsx';
import NoticeBanner from '@/components/ui/notice-banner.jsx';
import { Separator } from '@/components/ui/separator.jsx';
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils.js';

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

const WhatsAppCampaigns = (props: Parameters<typeof useWhatsAppConnect>[0]) => {
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
  } = useWhatsAppConnect(props);

  const backLabel = 'Voltar';
  const journeySteps = ['Instâncias & Canais', 'Campanhas', 'Inbox'];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-4 rounded-[var(--radius)] border border-[var(--border)] bg-surface-overlay-strong px-6 py-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-inbox-foreground-muted)]">
          {journeySteps.map((step, index) => (
            <div
              key={step}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-3 py-1',
                index === 1 ? 'border-primary/50 bg-primary/15 text-primary' : 'border-border/70 text-muted-foreground',
              )}
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border/60 bg-background text-[0.65rem]">
                {index + 1}
              </span>
              <span>{step}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <Badge variant="secondary">{stepLabel}</Badge>
              {nextStage ? <span>Próximo: {nextStage}</span> : null}
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Gerencie suas campanhas</h1>
              <p className="max-w-2xl text-sm text-muted-foreground">{onboardingDescription}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {selectedInstance ? (
              <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-200">
                Instância ativa · {selectedInstance.name ?? selectedInstance.id}
              </Badge>
            ) : null}
            <Badge variant="status" tone={statusTone as any} className="gap-2 text-xs font-medium uppercase">
              {statusCopy.badge}
            </Badge>
            <div className="flex gap-2">
              {onBack ? (
                <Button variant="ghost" size="sm" onClick={onBack}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {backLabel}
                </Button>
              ) : null}
              <Button size="sm" onClick={() => setCreateCampaignOpen(true)} disabled={!canCreateCampaigns}>
                Nova campanha
              </Button>
            </div>
          </div>
        </div>
        <Separator className="section-divider" />
        <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs uppercase tracking-wide text-[color:var(--color-inbox-foreground-muted)]/70">
            Campanhas e roteamento
          </span>
          <span className="max-w-2xl text-sm text-muted-foreground">
            Organize o fluxo de leads criando campanhas conectadas às suas instâncias.
          </span>
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
        <CampaignsPanel
          agreementName={agreementName ?? undefined}
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
          canCreateCampaigns={canCreateCampaigns}
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
    </div>
  );
};

export default WhatsAppCampaigns;
