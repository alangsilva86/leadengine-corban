import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { cn } from '@/lib/utils.js';
import { AlertCircle, Link2, RefreshCcw } from 'lucide-react';
import { formatPhoneNumber } from '../lib/formatting';
import CampaignHistoryDialog from './CampaignHistoryDialog.jsx';
import InstanceSummaryCard from './InstanceSummaryCard.jsx';

const InstancesPanel = ({
  surfaceStyles,
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
  instanceHealth,
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
  const resolvedHealth = instanceHealth
    ? instanceHealth
    : (() => {
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
      })();

  const renderHealthSummary = () => {
    if (resolvedHealth.state === 'loading') {
      return <Badge variant="status" tone="info">Sincronizando instâncias…</Badge>;
    }

    if (resolvedHealth.state === 'empty') {
      return <Badge variant="status" tone="info">Nenhuma instância cadastrada</Badge>;
    }

    const summaryItems = [
      { key: 'connected', tone: 'success', label: 'Conectadas', value: resolvedHealth.totals.connected },
      { key: 'connecting', tone: 'info', label: 'Sincronizando', value: resolvedHealth.totals.connecting },
      {
        key: 'needsAttention',
        tone: 'warning',
        label: 'Requer ação',
        value: resolvedHealth.totals.needsAttention,
      },
      { key: 'offline', tone: 'neutral', label: 'Offline', value: resolvedHealth.totals.offline },
    ].filter((item) => item.value > 0 || item.key === 'connected');

    return summaryItems.map((item) => (
      <Badge key={item.key} variant="status" tone={item.tone}>
        {item.value} {item.label.toLowerCase()}
      </Badge>
    ));
  };

  const complementaryInfoAvailable = Boolean(
    (agreementDisplayName && agreementDisplayName !== 'Nenhuma origem vinculada') ||
      selectedAgreementRegion ||
      (hasCampaign && campaign)
  );

  return (
    <Card className={cn(surfaceStyles.instancesPanel)}>
      <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <CardTitle>Saúde do canal do WhatsApp</CardTitle>
          <CardDescription>
            Acompanhe a conexão das instâncias, gere QR Codes e confirme quando o canal estiver pronto para receber leads.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectedAgreementId ? <CampaignHistoryDialog agreementId={selectedAgreementId} /> : null}
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
        <div className={cn('space-y-4 rounded-[var(--radius)] p-4', surfaceStyles.glassTile)}>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Instância em foco</p>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-foreground">
                  {selectedInstance?.name || selectedInstance?.id || 'Selecione um canal'}
                </p>
                {selectedInstanceStatusInfo ? (
                  <Badge variant={selectedInstanceStatusInfo.variant} className="px-2 py-0 text-[0.65rem]">
                    {selectedInstanceStatusInfo.label}
                  </Badge>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedInstance
                  ? `Telefone: ${formatPhoneNumber(selectedInstancePhone)}`
                  : 'Escolha uma instância para liberar ações rápidas e acompanhar o status em tempo real.'}
              </p>
            </div>
            <div className="flex flex-col items-end gap-3">
              <div className="flex flex-wrap gap-2">
                {localStatus !== 'connected' ? (
                  <Button onClick={onMarkConnected} disabled={isBusy || !isAuthenticated} size="sm">
                    Marcar como conectado
                  </Button>
                ) : null}
                <Button onClick={onConfirm} disabled={confirmDisabled} size="sm">
                  {confirmLabel}
                </Button>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Link2 className="h-4 w-4" />
                <span>
                  Status atual: <span className="font-medium text-foreground">{copy.badge}</span>
                </span>
              </div>
              <p className="max-w-xs text-right text-[0.7rem] text-muted-foreground/80">{copy.description}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[0.7rem] text-muted-foreground">
            {renderHealthSummary()}
            <span className="text-[0.65rem] uppercase tracking-wide text-muted-foreground/80">
              {instancesCountLabel}
            </span>
          </div>
        </div>

        {complementaryInfoAvailable ? (
          <div
            className={cn(
              'space-y-3 rounded-[var(--radius)] border border-dashed border-border/60 p-4 text-sm text-muted-foreground',
              surfaceStyles.glassTile
            )}
          >
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <Badge variant="outline" className="px-2 py-0 text-[0.65rem] uppercase" aria-hidden="true">
                Opcional
              </Badge>
              <span>Dados de origem e campanhas</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Origem comercial</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {agreementDisplayName || 'Nenhuma origem vinculada'}
                </p>
                {selectedAgreementRegion ? (
                  <p className="text-xs text-muted-foreground">{selectedAgreementRegion}</p>
                ) : null}
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Campanha</p>
                {hasCampaign && campaign ? (
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">{campaign.name}</p>
                    {campaign.updatedAt ? (
                      <p className="text-xs text-muted-foreground">
                        Atualizada em {new Date(campaign.updatedAt).toLocaleString('pt-BR')}
                      </p>
                    ) : null}
                    {campaign.instanceName || campaign.instanceId ? (
                      <p className="text-xs text-muted-foreground">
                        Instância vinculada: {campaign.instanceName || campaign.instanceId}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Vincule campanhas quando precisar de regras avançadas de distribuição.
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : null}

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
    </Card>
  );
};

export default InstancesPanel;
