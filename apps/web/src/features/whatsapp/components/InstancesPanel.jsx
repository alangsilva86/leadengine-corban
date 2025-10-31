import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { cn } from '@/lib/utils.js';
import { AlertCircle, Link2, RefreshCcw } from 'lucide-react';
import { formatPhoneNumber } from '../lib/formatting';
import CampaignHistoryDialog from './CampaignHistoryDialog.jsx';
import InstanceSummaryCard from './InstanceSummaryCard.jsx';

const InstancesPanel = ({
  surfaceStyles,
  hasAgreement,
  nextStage,
  agreementDisplayName,
  selectedAgreementRegion,
  selectedAgreementId,
  selectedInstance,
  selectedInstanceStatusInfo,
  selectedInstancePhone,
  hasCampaign,
  campaign,
  instancesReady,
  hasHiddenInstances,
  hasRenderableInstances,
  instanceViewModels,
  showFilterNotice,
  showAllInstances,
  instancesCountLabel,
  errorState,
  isBusy,
  isAuthenticated,
  loadingInstances,
  copy,
  localStatus,
  confirmLabel,
  confirmDisabled,
  onConfirm,
  onMarkConnected,
  onRefresh,
  onCreateInstance,
  onToggleShowAll,
  onShowAll,
  onRetry,
  onSelectInstance,
  onViewQr,
  onRequestDelete,
  deletingInstanceId,
  statusCodeMeta,
}) => {
  return (
    <Card className={cn(surfaceStyles.instancesPanel)}>
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle>Painel de instâncias</CardTitle>
          <CardDescription>
            {hasAgreement
              ? `Vincule o número certo ao convênio e confirme para avançar para ${nextStage}. Campanhas permanecem opcionais para quem precisa de regras avançadas.`
              : 'Conecte um número do WhatsApp e avance. Se quiser regras de roteamento, crie campanhas opcionais quando fizer sentido.'}
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CampaignHistoryDialog agreementId={selectedAgreementId} />
          <Button
            size="sm"
            variant="outline"
            onClick={onRefresh}
            disabled={loadingInstances || !isAuthenticated}
          >
            <RefreshCcw className="mr-2 h-4 w-4" /> Atualizar lista
          </Button>
          <Button size="sm" variant="secondary" onClick={onCreateInstance}>
            + Nova instância
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className={cn('grid gap-4 rounded-[var(--radius)] p-4 text-sm', surfaceStyles.glassTile)}>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Convênio</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{agreementDisplayName}</p>
              {selectedAgreementRegion ? (
                <p className="text-xs text-muted-foreground">{selectedAgreementRegion}</p>
              ) : null}
            </div>
            <div className="max-w-[260px] sm:max-w-full">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Instância selecionada</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-foreground">
                  {selectedInstance?.name || selectedInstance?.id || 'Escolha uma instância'}
                </p>
                {selectedInstanceStatusInfo ? (
                  <Badge variant={selectedInstanceStatusInfo.variant} className="px-2 py-0 text-[0.65rem]">
                    {selectedInstanceStatusInfo.label}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {selectedInstance ? `Telefone: ${formatPhoneNumber(selectedInstancePhone)}` : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Campanha</p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {hasCampaign ? campaign.name : 'Será criada após a confirmação'}
              </p>
              {hasCampaign && campaign.updatedAt ? (
                <p className="text-xs text-muted-foreground">
                  Atualizada em {new Date(campaign.updatedAt).toLocaleString('pt-BR')}
                </p>
              ) : hasCampaign ? (
                <p className="text-xs text-muted-foreground">
                  Instância vinculada: {campaign.instanceName || campaign.instanceId}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Será ligada ao número selecionado.</p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs uppercase tracking-wide text-[color:var(--color-inbox-foreground-muted)]/70">
            <span>Instâncias disponíveis</span>
            <div className="flex items-center gap-2">
              {instancesReady && hasHiddenInstances && hasRenderableInstances ? (
                <Button
                  type="button"
                  size="sm"
                  variant="link"
                  className="h-auto px-0 text-[0.65rem] uppercase"
                  onClick={onToggleShowAll}
                >
                  {showAllInstances ? 'Ocultar desconectadas' : 'Mostrar todas'}
                </Button>
              ) : null}
              <span>{instancesCountLabel}</span>
            </div>
          </div>
          {showFilterNotice ? (
            <p className="text-[0.7rem] text-muted-foreground">
              Mostrando apenas instâncias conectadas. Use “Mostrar todas” para acessar sessões desconectadas.
            </p>
          ) : null}

          {!instancesReady ? (
            <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
              {Array.from({ length: 2 }).map((_, index) => (
                <div
                  key={index}
                  className={cn('flex h-full w-full flex-col rounded-2xl p-4', surfaceStyles.glassTile)}
                >
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="mt-2 h-4 w-1/2" />
                  <Skeleton className="mt-2 h-4 w-2/3" />
                  <div className="mt-4 grid gap-2">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                  <Skeleton className="mt-4 h-10 w-24" />
                </div>
              ))}
            </div>
          ) : hasRenderableInstances ? (
            <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
              {instanceViewModels.map((viewModel) => (
                <InstanceSummaryCard
                  key={viewModel.key}
                  surfaceStyles={surfaceStyles}
                  viewModel={viewModel}
                  statusCodeMeta={statusCodeMeta}
                  isBusy={isBusy}
                  isAuthenticated={isAuthenticated}
                  deletingInstanceId={deletingInstanceId}
                  onSelectInstance={onSelectInstance}
                  onViewQr={onViewQr}
                  onRequestDelete={onRequestDelete}
                />
              ))}
            </div>
          ) : hasHiddenInstances ? (
            <div
              className={cn('rounded-2xl p-6 text-center text-sm text-muted-foreground', surfaceStyles.glassTileDashed)}
            >
              <p>Nenhuma instância conectada no momento. Mostre todas para gerenciar sessões desconectadas.</p>
              <Button size="sm" className="mt-4" onClick={onShowAll} disabled={isBusy}>
                Mostrar todas
              </Button>
            </div>
          ) : (
            <div
              className={cn('rounded-2xl p-6 text-center text-sm text-muted-foreground', surfaceStyles.glassTileDashed)}
            >
              <p>Nenhuma instância encontrada. Crie uma nova para iniciar a sincronização com o Lead Engine.</p>
              <Button size="sm" className="mt-4" onClick={onCreateInstance}>
                Criar instância agora
              </Button>
            </div>
          )}
        </div>

        {errorState ? (
          <div
            className={cn(
              'flex flex-wrap items-start gap-3 rounded-[var(--radius)] p-3 text-xs',
              surfaceStyles.destructiveBanner
            )}
          >
            <AlertCircle className="mt-0.5 h-4 w-4" />
            <div className="flex-1 space-y-1">
              <p className="font-medium">{errorState.title ?? 'Algo deu errado'}</p>
              <p>{errorState.message}</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button size="sm" variant="outline" onClick={onRetry}>
                Tentar novamente
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
      <CardFooter className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link2 className="h-4 w-4" />
          Status atual: <span className="font-medium text-foreground">{copy.badge}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {localStatus !== 'connected' ? (
            <Button onClick={onMarkConnected} disabled={isBusy || !isAuthenticated}>
              Marcar como conectado
            </Button>
          ) : null}
          <Button onClick={onConfirm} disabled={confirmDisabled}>
            {confirmLabel}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default InstancesPanel;
