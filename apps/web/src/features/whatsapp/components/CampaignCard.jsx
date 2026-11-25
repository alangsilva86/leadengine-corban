import { useMemo } from 'react';
import { ArrowRight, History, Loader2, MoreHorizontal, Pause, Pencil, Play, Repeat, XCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.jsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';

import { NumberStatusDot } from './numbers/NumberStatusBadge';
import { CAMPAIGN_STATUS_BADGE_VARIANT, formatNumber, statusMeta } from '../utils/campaign-helpers.js';
import { findCampaignProduct } from '../utils/campaign-options.js';
import { formatRelativeTime } from '@/lib/relative-time';

const normalize = (value) =>
  `${value ?? ''}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const resolveProductLabel = (campaign) => {
  const metadata = campaign?.metadata && typeof campaign.metadata === 'object' ? campaign.metadata : {};
  const value = campaign?.productType ?? campaign?.product ?? metadata.product ?? metadata.productKey ?? null;
  return value ? findCampaignProduct(value)?.label ?? null : null;
};

/** "INSS · Cartão benefício" — origem e produto são o que o time reconhece. */
export const resolveCampaignTitle = (campaign) => {
  const origin = campaign?.agreementName?.trim() || null;
  const product = resolveProductLabel(campaign);
  if (origin && product) return `${origin} · ${product}`;
  return origin ?? campaign?.name ?? 'Regra sem nome';
};

const Metric = ({ label, value }) => (
  <div className="min-w-0">
    <dt className="truncate text-xs text-muted-foreground">{label}</dt>
    <dd className="text-lg font-semibold tabular-nums text-foreground">{formatNumber(value ?? 0)}</dd>
  </div>
);

/**
 * Cartão de regra: origem/produto, número de destino com status, métricas e ações.
 * "Encerrar" só dispara o pedido de confirmação (quem confirma é a página).
 */
const CampaignCard = ({ campaign, number = null, busyAction = null, onPause, onResume, onChangeNumber, onRename, onHistory, onEnd }) => {
  const title = useMemo(() => resolveCampaignTitle(campaign), [campaign]);
  const showName = campaign?.name && normalize(campaign.name) !== normalize(title);
  const status = statusMeta[campaign.status] ?? { label: 'Rascunho' };
  const isActive = campaign.status === 'active';
  const isEnded = campaign.status === 'ended';
  const isBusy = Boolean(busyAction);
  const metrics = campaign.metrics ?? {};
  const updatedLabel = formatRelativeTime(campaign.updatedAt);
  const numberLabel = number?.name ?? campaign.instanceName ?? null;
  const numberOffline = Boolean(number && !number.status.isConnected);

  return (
    <article
      aria-labelledby={`campaign-${campaign.id}-title`}
      className="flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-surface p-4 shadow-xs sm:p-5"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 id={`campaign-${campaign.id}-title`} className="truncate text-base font-semibold text-foreground">
            {title}
          </h3>
          {showName ? <p className="truncate text-xs text-muted-foreground">{campaign.name}</p> : null}
        </div>
        <Badge variant={CAMPAIGN_STATUS_BADGE_VARIANT[campaign.status] ?? 'secondary'} className="shrink-0">
          {status.label}
        </Badge>
      </header>

      <div className="flex min-w-0 items-center gap-2 text-sm">
        <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        {campaign.instanceId ? (
          <span className="flex min-w-0 items-center gap-1.5">
            {number ? <NumberStatusDot status={number.status} /> : null}
            <span className="truncate font-medium text-foreground">{numberLabel ?? 'Número removido'}</span>
            {number?.phone ? <span className="hidden truncate tabular-nums text-muted-foreground sm:inline">{number.phone}</span> : null}
            {numberOffline ? (
              <span className="shrink-0 text-xs text-warning-soft-foreground">· {number.status.label}</span>
            ) : null}
          </span>
        ) : (
          <span className="flex min-w-0 flex-wrap items-center gap-x-1.5">
            <span className="font-medium text-warning-soft-foreground">Sem número</span>
            <span className="text-muted-foreground">· leads aguardando</span>
            {!isEnded ? (
              <Button type="button" variant="link" size="sm" className="ml-1 h-auto" onClick={() => onChangeNumber?.(campaign)}>
                Escolher número
              </Button>
            ) : null}
          </span>
        )}
      </div>

      <dl className="grid grid-cols-3 gap-3 rounded-lg bg-surface-sunken px-4 py-3">
        <Metric label="Leads" value={metrics.total} />
        <Metric label="Contactados" value={metrics.contacted} />
        <Metric label="Convertidos" value={metrics.won} />
      </dl>

      <footer className="flex items-center justify-between gap-3">
        <p className="truncate text-xs text-muted-foreground">
          {updatedLabel ? `Atualizada ${updatedLabel}` : null}
        </p>
        {!isEnded ? (
          <div className="flex shrink-0 items-center gap-1">
            {isActive ? (
              <Button type="button" variant="outline" size="sm" onClick={() => onPause?.(campaign)} disabled={isBusy}>
                {busyAction === 'paused' ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Pause aria-hidden="true" />}
                Pausar
              </Button>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={() => onResume?.(campaign)} disabled={isBusy}>
                {busyAction === 'active' ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Play aria-hidden="true" />}
                {campaign.status === 'draft' ? 'Ativar' : 'Retomar'}
              </Button>
            )}
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Mais ações para ${title}`}
                      disabled={isBusy}
                    >
                      {isBusy && !['paused', 'active'].includes(busyAction) ? (
                        <Loader2 aria-hidden="true" className="animate-spin" />
                      ) : (
                        <MoreHorizontal aria-hidden="true" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Mais ações</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onSelect={() => onRename?.(campaign)}>
                  <Pencil aria-hidden="true" />
                  Renomear
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onChangeNumber?.(campaign)}>
                  <Repeat aria-hidden="true" />
                  {campaign.instanceId ? 'Trocar número' : 'Escolher número'}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onHistory?.(campaign)} disabled={!campaign.agreementId}>
                  <History aria-hidden="true" />
                  Histórico da origem
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => onEnd?.(campaign)}>
                  <XCircle aria-hidden="true" />
                  Encerrar regra
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}
      </footer>
    </article>
  );
};

export default CampaignCard;
