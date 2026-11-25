import { Suspense, lazy, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Megaphone, Plus, Smartphone } from 'lucide-react';

import { EmptyState, ErrorState, PageHeader } from '@/components/page';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';

import useCampaignsPage from './hooks/useCampaignsPage';
import CampaignsPanel from '../components/CampaignsPanel.jsx';
import { resolveCampaignTitle } from '../components/CampaignCard.jsx';

const CreateCampaignDialog = lazy(() => import('../components/CreateCampaignDialog.jsx'));
const ReassignCampaignDialog = lazy(() => import('../components/ReassignCampaignDialog.jsx'));
const CampaignHistoryDialog = lazy(() => import('../components/CampaignHistoryDialog.jsx'));
const RenameCampaignDialog = lazy(() => import('../components/RenameCampaignDialog.jsx'));

const plural = (count: number, singular: string, pluralForm: string) => `${count} ${count === 1 ? singular : pluralForm}`;

const MetaItem = ({ children, className }: { children: ReactNode; className?: string }) => (
  <>
    <span aria-hidden="true">·</span>
    <span className={className}>{children}</span>
  </>
);

const CardsSkeleton = () => (
  <div aria-busy="true" aria-label="Carregando regras de roteamento" className="grid gap-4 lg:grid-cols-2">
    {Array.from({ length: 2 }).map((_, index) => (
      <div key={index} className="space-y-4 rounded-xl border border-border bg-surface p-5 shadow-xs">
        <div className="flex justify-between">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    ))}
  </div>
);

/** Pré-requisito: sem número conectado não dá para criar regra. Nada de overlay sobre a página. */
const PrerequisiteCard = ({ hasNumbers }: { hasNumbers: boolean }) => (
  <section
    aria-labelledby="campaigns-prerequisite"
    className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-xs sm:flex-row sm:items-center"
  >
    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-whatsapp-soft text-whatsapp-soft-foreground">
      <Smartphone aria-hidden="true" className="size-5" />
    </div>
    <div className="min-w-0 flex-1 space-y-1">
      <h2 id="campaigns-prerequisite" className="text-base font-semibold text-foreground">
        {hasNumbers ? 'Nenhum número conectado agora' : 'Conecte um número para criar regras de roteamento'}
      </h2>
      <p className="text-sm text-muted-foreground">
        {hasNumbers
          ? 'Reconecte um número de WhatsApp para criar ou retomar regras.'
          : 'Regras de roteamento encaminham os leads de uma origem (convênio ou parceiro) para um número de WhatsApp conectado.'}
      </p>
    </div>
    <Button asChild className="w-full sm:w-auto">
      <Link to={hasNumbers ? '/channels' : '/channels?connect=1'}>{hasNumbers ? 'Ver números' : 'Conectar número'}</Link>
    </Button>
  </section>
);

const WhatsAppCampaigns = () => {
  const page = useCampaignsPage();
  const [endTarget, setEndTarget] = useState<any>(null);
  const [ending, setEnding] = useState(false);
  const [renameTarget, setRenameTarget] = useState<any>(null);
  const [historyTarget, setHistoryTarget] = useState<any>(null);

  const { numbers, counts } = page;
  const hasCampaigns = page.campaigns.length > 0;
  const loading = !numbers.ready || (!page.campaignsLoaded && !page.campaignError);
  const locked = numbers.ready && !page.canCreateCampaigns;

  const defaultInstanceId = useMemo(
    () => numbers.numbers.find((number) => number.status.isConnected)?.id,
    [numbers.numbers],
  );

  const openCreate = () => page.setCreateCampaignOpen(true);

  const meta = hasCampaigns ? (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {counts.active > 0 ? (
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2 rounded-full bg-success" />
          {plural(counts.active, 'ativa', 'ativas')}
        </span>
      ) : (
        <span>Nenhuma ativa</span>
      )}
      {counts.paused > 0 ? <MetaItem>{plural(counts.paused, 'pausada', 'pausadas')}</MetaItem> : null}
      {counts.draft > 0 ? <MetaItem>{plural(counts.draft, 'rascunho', 'rascunhos')}</MetaItem> : null}
      {counts.withoutNumber > 0 ? (
        <MetaItem className="text-warning-soft-foreground">{plural(counts.withoutNumber, 'sem número', 'sem número')}</MetaItem>
      ) : null}
    </span>
  ) : null;

  const newCampaignButton = (
    <Button type="button" onClick={openCreate} disabled={!page.canCreateCampaigns}>
      <Plus aria-hidden="true" />
      Nova regra
    </Button>
  );

  const actions = locked ? (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* Botão desabilitado não recebe foco/hover: o wrapper garante a explicação. */}
        <span tabIndex={0} className="inline-flex rounded-md">
          {newCampaignButton}
        </span>
      </TooltipTrigger>
      <TooltipContent>Conecte um número de WhatsApp para criar regras de roteamento.</TooltipContent>
    </Tooltip>
  ) : (
    newCampaignButton
  );

  let content: ReactNode;
  if (loading) {
    content = <CardsSkeleton />;
  } else if (page.campaignError && !hasCampaigns) {
    content = (
      <div className="rounded-xl border border-border bg-surface shadow-xs">
        <ErrorState
          title="Não foi possível carregar as regras"
          description={page.campaignError}
          onRetry={() => void page.reloadCampaigns()}
        />
      </div>
    );
  } else if (!hasCampaigns) {
    content = locked ? null : (
      <div className="rounded-xl border border-border bg-surface shadow-xs">
        <EmptyState
          icon={Megaphone}
          title="Nenhuma regra de roteamento ainda"
          description="Crie uma regra para levar os leads de uma origem (convênio ou parceiro) direto para o número certo."
          action={
            <Button type="button" onClick={openCreate}>
              <Plus aria-hidden="true" />
              Nova regra
            </Button>
          }
        />
      </div>
    );
  } else {
    content = (
      <CampaignsPanel
        campaigns={page.campaigns}
        numbersById={page.numbersById}
        actionState={page.campaignAction}
        onPause={(target: any) => void page.updateCampaignStatus(target, 'paused').catch(() => undefined)}
        onResume={(target: any) => void page.updateCampaignStatus(target, 'active').catch(() => undefined)}
        onChangeNumber={(target: any) => {
          page.setReassignIntent('reassign');
          page.setPendingReassign(target);
        }}
        onRename={(target: any) => setRenameTarget(target)}
        onHistory={(target: any) => setHistoryTarget(target)}
        onEnd={(target: any) => setEndTarget(target)}
      />
    );
  }

  const handleEnd = async () => {
    if (!endTarget) return;
    setEnding(true);
    try {
      await page.deleteCampaign(endTarget);
      setEndTarget(null);
    } catch {
      // O aviso de erro já foi exibido; mantém o diálogo aberto para tentar de novo.
    } finally {
      setEnding(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader
        title="Regras de roteamento"
        description="Direcione os leads de cada origem para o número de WhatsApp certo."
        meta={meta}
        actions={actions}
      />

      {locked && !loading ? <PrerequisiteCard hasNumbers={numbers.numbers.length > 0} /> : null}

      {content}

      <Suspense fallback={null}>
        {page.isCreateCampaignOpen ? (
          <CreateCampaignDialog
            open={page.isCreateCampaignOpen}
            onOpenChange={page.setCreateCampaignOpen}
            agreement={null}
            instances={numbers.instances}
            defaultInstanceId={defaultInstanceId}
            onSubmit={page.createCampaign}
          />
        ) : null}

        {page.pendingReassign ? (
          <ReassignCampaignDialog
            open={Boolean(page.pendingReassign)}
            onClose={(value: boolean) => {
              if (!value) page.setPendingReassign(null);
            }}
            campaign={page.pendingReassign}
            instances={numbers.instances}
            fetchImpact={page.fetchCampaignImpact}
            intent={page.reassignIntent}
            onSubmit={async ({ instanceId }: { instanceId?: string | null }) => {
              const target = page.pendingReassign;
              if (!target) return;
              await page.reassignCampaign(target, page.reassignIntent === 'disconnect' ? null : instanceId ?? null);
              page.setPendingReassign(null);
            }}
          />
        ) : null}

        {historyTarget ? (
          <CampaignHistoryDialog
            open={Boolean(historyTarget)}
            onOpenChange={(value: boolean) => {
              if (!value) setHistoryTarget(null);
            }}
            campaign={historyTarget}
            numbersById={page.numbersById}
          />
        ) : null}

        {renameTarget ? (
          <RenameCampaignDialog
            campaign={renameTarget}
            onOpenChange={(value: boolean) => {
              if (!value) setRenameTarget(null);
            }}
            onSubmit={page.renameCampaign}
          />
        ) : null}
      </Suspense>

      <AlertDialog
        open={Boolean(endTarget)}
        onOpenChange={(value: boolean) => {
          if (!value && !ending) setEndTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar {endTarget ? resolveCampaignTitle(endTarget) : 'regra'}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <ul className="list-disc space-y-1.5 pl-5">
                  <li>Novos leads desta origem deixam de ser distribuídos por esta regra.</li>
                  <li>O número fica livre para outras regras.</li>
                  <li>O histórico continua disponível em “Histórico da origem”.</li>
                </ul>
                <p className="font-medium text-foreground">Para voltar a distribuir, será preciso criar uma nova regra.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={ending}>Cancelar</AlertDialogCancel>
            <Button type="button" variant="destructive" onClick={handleEnd} disabled={ending}>
              {ending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
              Encerrar regra
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default WhatsAppCampaigns;
