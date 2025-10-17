import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { cn } from '@/lib/utils.js';
import { AlertCircle, Link2, Loader2, QrCode, RefreshCcw, Trash2 } from 'lucide-react';
import CampaignHistoryDialog from './CampaignHistoryDialog.jsx';

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
  renderInstances,
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
  getStatusInfo,
  getInstanceMetrics,
  formatMetricValue,
  resolveInstancePhone,
  formatPhoneNumber,
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
              {renderInstances.map((item, index) => {
                const isCurrent = selectedInstance?.id === item.id;
                const statusInfo = getStatusInfo(item);
                const metrics = getInstanceMetrics(item);
                const statusValues = metrics.status || {};
                const rateUsage = metrics.rateUsage || { used: 0, limit: 0, remaining: 0, percentage: 0 };
                const ratePercentage = Math.max(0, Math.min(100, rateUsage.percentage ?? 0));
                const phoneLabel = resolveInstancePhone(item);
                const addressLabel = item.address || item.jid || item.session || '';
                const lastUpdated = item.updatedAt || item.lastSeen || item.connectedAt;
                const lastUpdatedLabel = lastUpdated ? new Date(lastUpdated).toLocaleString('pt-BR') : '—';

                return (
                  <div
                    key={item.id || item.name || index}
                    className={cn(
                      'flex h-full w-full flex-col rounded-2xl border p-4 transition-colors',
                      isCurrent ? surfaceStyles.glassTileActive : surfaceStyles.glassTileIdle
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-foreground">{item.name || item.id}</p>
                        <p className="text-xs text-muted-foreground">{formatPhoneNumber(phoneLabel) || '—'}</p>
                        {addressLabel && addressLabel !== phoneLabel ? (
                          <p className="text-xs text-muted-foreground">{addressLabel}</p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Remover instância"
                          title="Remover instância"
                          disabled={deletingInstanceId === item.id}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            onRequestDelete?.(item);
                          }}
                        >
                          {deletingInstanceId === item.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      <div className="grid grid-cols-1 gap-2 text-center sm:grid-cols-3">
                        <div className={cn('rounded-lg p-3', surfaceStyles.glassTile)}>
                          <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Enviadas</p>
                          <p className="mt-1 text-base font-semibold text-foreground">
                            {formatMetricValue(metrics.sent)}
                          </p>
                        </div>
                        <div className={cn('rounded-lg p-3', surfaceStyles.glassTile)}>
                          <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Na fila</p>
                          <p className="mt-1 text-base font-semibold text-foreground">
                            {formatMetricValue(metrics.queued)}
                          </p>
                        </div>
                        <div className={cn('rounded-lg p-3', surfaceStyles.glassTile)}>
                          <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Falhas</p>
                          <p className="mt-1 text-base font-semibold text-foreground">
                            {formatMetricValue(metrics.failed)}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-2 text-center sm:grid-cols-3 lg:grid-cols-5">
                        {statusCodeMeta.map((meta) => (
                          <div
                            key={meta.code}
                            className={cn('rounded-lg p-3', surfaceStyles.glassTile)}
                            title={meta.description}
                          >
                            <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">{meta.label}</p>
                            <p className="mt-1 text-base font-semibold text-foreground">
                              {formatMetricValue(statusValues[meta.code])}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div
                        className={cn('rounded-lg p-3 text-left', surfaceStyles.glassTile)}
                        title="Uso do limite de envio reportado pelo broker."
                      >
                        <div className="flex items-center justify-between text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                          <span>Utilização do limite</span>
                          <span>{ratePercentage}%</span>
                        </div>
                        <div
                          className={cn('mt-2 h-2 w-full overflow-hidden rounded-full', surfaceStyles.progressTrack)}
                        >
                          <div
                            className={cn('h-full rounded-full transition-all', surfaceStyles.progressIndicator)}
                            style={{ width: `${ratePercentage}%` }}
                          />
                        </div>
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span>Usadas: {formatMetricValue(rateUsage.used)}</span>
                          <span>Disponível: {formatMetricValue(rateUsage.remaining)}</span>
                          <span>Limite: {formatMetricValue(rateUsage.limit)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>Atualizado: {lastUpdatedLabel}</span>
                      {item.user ? <span>Operador: {item.user}</span> : null}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant={isCurrent ? 'default' : 'outline'}
                        onClick={() => onSelectInstance?.(item)}
                        disabled={isBusy}
                      >
                        {isCurrent ? 'Instância selecionada' : 'Selecionar'}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => onViewQr?.(item)}
                        disabled={isBusy || !isAuthenticated}
                      >
                        <QrCode className="mr-2 h-3.5 w-3.5" /> Ver QR
                      </Button>
                    </div>
                  </div>
                );
              })}
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
