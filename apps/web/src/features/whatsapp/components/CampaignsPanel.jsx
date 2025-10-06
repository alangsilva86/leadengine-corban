import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import NoticeBanner from '@/components/ui/notice-banner.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import {
  ArrowLeftRight,
  Loader2,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCcw,
  Trash2,
} from 'lucide-react';

const statusMeta = {
  active: { label: 'Ativa', variant: 'success' },
  paused: { label: 'Pausada', variant: 'warning' },
  draft: { label: 'Rascunho', variant: 'info' },
  ended: { label: 'Encerrada', variant: 'secondary' },
};

const formatDateTime = (value) => {
  if (!value) {
    return '—';
  }
  try {
    const parsed = typeof value === 'string' || value instanceof Date ? new Date(value) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) {
      return '—';
    }
    return parsed.toLocaleString('pt-BR');
  } catch {
    return '—';
  }
};

const formatNumber = (value) =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(value ?? 0);

const CampaignsPanel = ({
  agreementName,
  campaigns,
  loading,
  error,
  onRefresh,
  onCreateClick,
  onPause,
  onActivate,
  onDelete,
  onReassign,
  actionState,
  selectedInstanceId,
}) => {
  const totalCampaigns = campaigns.length;
  const activeCampaigns = campaigns.filter((entry) => entry.status === 'active').length;

  const isProcessing = (campaignId, type) =>
    Boolean(actionState?.id === campaignId && (!type || actionState.type === type));

  const renderEmptyState = () => (
    <div className="rounded-xl border border-dashed border-white/10 bg-white/5 p-6 text-center text-sm text-muted-foreground">
      <p>Nenhuma campanha cadastrada para este convênio.</p>
      <Button size="sm" className="mt-4" onClick={onCreateClick}>
        <Plus className="mr-2 h-4 w-4" /> Criar primeira campanha
      </Button>
    </div>
  );

  const renderCampaignCard = (campaign) => {
    const statusInfo = statusMeta[campaign.status] ?? {
      label: campaign.status,
      variant: 'secondary',
    };

    const highlight =
      campaign.instanceId && campaign.instanceId === (selectedInstanceId ?? null);
    const metrics = campaign.metrics ?? {};
    const isEnded = campaign.status === 'ended';

    return (
      <div
        key={campaign.id}
        className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">{campaign.name}</p>
            <p className="text-xs text-muted-foreground">ID: {campaign.id}</p>
            <p className="text-xs text-muted-foreground">
              Instância: {campaign.instanceName || campaign.instanceId || '—'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {highlight ? <Badge variant="info">Instância selecionada</Badge> : null}
            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[{
            label: 'Leads recebidos',
            value: metrics.total,
          },
          {
            label: 'Contactados',
            value: metrics.contacted,
          },
          {
            label: 'Ganhos',
            value: metrics.won,
          },
          {
            label: 'Perdidos',
            value: metrics.lost,
          }].map((item) => (
            <div
              key={item.label}
              className="rounded-lg border border-white/10 bg-white/5 p-3 text-center"
            >
              <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                {item.label}
              </p>
              <p className="mt-1 text-lg font-semibold text-foreground">
                {formatNumber(item.value)}
              </p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>Atualizada em {formatDateTime(campaign.updatedAt)}</span>
          <div className="flex flex-wrap gap-2">
            {!isEnded && campaign.status !== 'active' ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onActivate?.(campaign)}
                disabled={isProcessing(campaign.id)}
              >
                {isProcessing(campaign.id, 'active') ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <PlayCircle className="mr-2 h-4 w-4" />
                )}
                Ativar
              </Button>
            ) : null}
            {!isEnded && campaign.status === 'active' ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onPause?.(campaign)}
                disabled={isProcessing(campaign.id)}
              >
                {isProcessing(campaign.id, 'paused') ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <PauseCircle className="mr-2 h-4 w-4" />
                )}
                Pausar
              </Button>
            ) : null}
            {!isEnded ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onReassign?.(campaign)}
                disabled={isProcessing(campaign.id)}
              >
                {isProcessing(campaign.id, 'reassign') ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowLeftRight className="mr-2 h-4 w-4" />
                )}
                Reatribuir
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDelete?.(campaign)}
              disabled={isProcessing(campaign.id)}
            >
              {isProcessing(campaign.id, 'delete') ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Encerrar
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className="border border-[var(--border)]/60 bg-[rgba(15,23,42,0.45)]">
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle>Painel de campanhas</CardTitle>
          <CardDescription>
            {agreementName
              ? `Gerencie campanhas ligadas ao convênio ${agreementName}.`
              : 'Selecione um convênio para visualizar as campanhas vinculadas.'}
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="info">{activeCampaigns} ativa(s)</Badge>
          <Badge variant="secondary">{totalCampaigns} no total</Badge>
          <Button
            size="sm"
            variant="outline"
            onClick={onRefresh}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="mr-2 h-4 w-4" />
            )}
            Atualizar
          </Button>
          <Button size="sm" onClick={onCreateClick}>
            <Plus className="mr-2 h-4 w-4" /> Nova campanha
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <NoticeBanner variant="danger">
            <p>{error}</p>
          </NoticeBanner>
        ) : null}

        {loading && campaigns.length === 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <Skeleton key={index} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : null}

        {!loading && campaigns.length === 0 ? renderEmptyState() : null}

        {campaigns.length > 0 ? (
          <div className="space-y-3">
            {campaigns.map(renderCampaignCard)}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

export default CampaignsPanel;
