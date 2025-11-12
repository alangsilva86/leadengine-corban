import { useMemo } from 'react';

import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu.jsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import { ArrowLeftRight, Link as LinkIcon, Link2Off, Loader2, MoreVertical, PauseCircle, PlayCircle, Trash2 } from 'lucide-react';

import CampaignMetricsGrid from './CampaignMetricsGrid.jsx';
import { statusMeta } from '../utils/campaign-helpers.js';
import { findCampaignProduct, findCampaignStrategy } from '../utils/campaign-options.js';
import { formatAgreementLabel } from '../utils/campaign-formatters.js';
import { formatDateTime } from '../../chat/utils/datetime.js';

const parseMarginValue = (rawValue) => {
  if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
    return rawValue;
  }

  if (typeof rawValue === 'string' && rawValue.trim().length > 0) {
    const parsed = Number(rawValue);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const resolveMetadata = (campaign) =>
  campaign.metadata && typeof campaign.metadata === 'object' && !Array.isArray(campaign.metadata)
    ? campaign.metadata
    : {};

const resolveMargin = (campaign, metadata) =>
  metadata.margin ??
  metadata.marginTarget ??
  metadata.marginPercentage ??
  metadata.marginPercent ??
  (typeof campaign.marginValue === 'number' ? campaign.marginValue : null) ??
  (typeof campaign.margin === 'number' ? campaign.margin : null);

const resolveInstanceLabel = (campaign) => {
  if (campaign.instanceId) {
    return campaign.instanceName || campaign.instanceId;
  }
  return 'Aguardando vínculo';
};

const CampaignCard = ({
  campaign,
  isProcessing,
  onActivate,
  onDelete,
  onDisconnect,
  onPause,
  onReassign,
  selectedInstanceId,
}) => {
  const statusInfo = statusMeta[campaign.status] ?? {
    label: campaign.status,
    variant: 'secondary',
  };

  const isLinked = Boolean(campaign.instanceId);
  const isEnded = campaign.status === 'ended';
  const highlight = campaign.instanceId && campaign.instanceId === (selectedInstanceId ?? null);
  const metadata = useMemo(() => resolveMetadata(campaign), [campaign]);

  const productValue =
    campaign.productType ??
    campaign.product ??
    metadata.product ??
    metadata.productKey ??
    metadata.productValue ??
    null;

  const strategyValue = metadata.strategy ?? metadata.strategyKey ?? campaign.strategy ?? null;
  const marginRaw = useMemo(() => resolveMargin(campaign, metadata), [campaign, metadata]);

  const productOption = useMemo(
    () => (productValue ? findCampaignProduct(productValue) : null),
    [productValue]
  );

  const strategyOption = useMemo(
    () => (strategyValue ? findCampaignStrategy(strategyValue) : null),
    [strategyValue]
  );

  const marginValue = useMemo(() => parseMarginValue(marginRaw), [marginRaw]);
  const agreementLabel = useMemo(() => formatAgreementLabel(campaign), [campaign]);
  const instanceLabel = useMemo(() => resolveInstanceLabel(campaign), [campaign]);
  const metrics = campaign.metrics ?? {};

  return (
    <div className="space-y-4 rounded-xl border border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <p className="text-base font-bold text-foreground">{campaign.name}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>ID: {campaign.id}</span>
            <span>•</span>
            <span>{agreementLabel}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[0.7rem] text-muted-foreground">
            {productOption ? <Badge variant="outline">{productOption.label}</Badge> : null}
            {typeof marginValue === 'number' ? (
              <Badge variant="outline">Margem {marginValue.toFixed(2)}%</Badge>
            ) : null}
            {strategyOption ? <Badge variant="secondary">{strategyOption.label}</Badge> : null}
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            {isLinked ? (
              <>
                <LinkIcon className="h-3.5 w-3.5 text-success" />
                <span className="text-success font-medium">{instanceLabel}</span>
              </>
            ) : (
              <>
                <Link2Off className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">{instanceLabel}</span>
              </>
            )}
          </div>
          {Array.isArray(campaign.tags) && campaign.tags.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {campaign.tags.map((tag) => (
                <Badge key={`${campaign.id}-${tag}`} variant="outline" className="text-[10px] uppercase">
                  {tag}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {highlight ? <Badge variant="info">Instância selecionada</Badge> : null}
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="secondary">{agreementLabel}</Badge>
            </TooltipTrigger>
            <TooltipContent>
              Origem comercial que identifica de onde vêm os leads desta campanha (convênio, parceiro ou carteira).
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant={isLinked ? 'success' : 'outline'}>
                {isLinked ? 'Instância vinculada' : 'Aguardando vínculo'}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              {isLinked
                ? `Leads inbound serão direcionados para ${instanceLabel}.`
                : 'Associe uma instância conectada quando quiser distribuir leads automaticamente.'}
            </TooltipContent>
          </Tooltip>
          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
        </div>
      </div>

      <CampaignMetricsGrid
        metrics={[
          { label: 'Leads recebidos', value: metrics.total },
          { label: 'Contactados', value: metrics.contacted },
          { label: 'Ganhos', value: metrics.won },
          { label: 'Perdidos', value: metrics.lost },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>Atualizada em {formatDateTime(campaign.updatedAt)}</span>
        <div className="flex flex-wrap gap-2">
          {!isEnded && campaign.status !== 'active' ? (
            <Button
              size="sm"
              variant="default"
              onClick={() => onActivate?.(campaign)}
              disabled={isProcessing(campaign.id)}
            >
              {isProcessing(campaign.id, 'active') ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <PlayCircle className="mr-2 h-4 w-4" />
              )}
              Ativar campanha
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" disabled={isProcessing(campaign.id)}>
                  {isProcessing(campaign.id) ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <MoreVertical className="mr-2 h-4 w-4" />
                  )}
                  Ações
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onReassign?.(campaign)} disabled={isProcessing(campaign.id)}>
                  <ArrowLeftRight className="mr-2 h-4 w-4" />
                  {isLinked ? 'Reatribuir instância' : 'Vincular instância'}
                </DropdownMenuItem>
                {isLinked ? (
                  <DropdownMenuItem onClick={() => onDisconnect?.(campaign)} disabled={isProcessing(campaign.id)}>
                    <Link2Off className="mr-2 h-4 w-4" />
                    Desvincular instância
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => onDelete?.(campaign)}
                  disabled={isProcessing(campaign.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Encerrar campanha
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default CampaignCard;
