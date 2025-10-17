import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card.jsx';
import NoticeBanner from '@/components/ui/notice-banner.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import {
  ArrowLeftRight,
  Link2Off,
  Loader2,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCcw,
  Trash2,
} from 'lucide-react';

import CampaignMetricsGrid from './CampaignMetricsGrid.jsx';
import { statusMeta } from '../utils/campaign-helpers.js';

const NO_AGREEMENT_VALUE = '__no_agreement__';
const NO_INSTANCE_VALUE = '__no_instance__';

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

const formatAgreementLabel = (campaign) => {
  if (campaign?.agreementName) {
    return campaign.agreementName;
  }
  if (campaign?.agreementId) {
    return `Convênio ${campaign.agreementId}`;
  }
  return 'Convênio não informado';
};

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
  onDisconnect,
  actionState,
  selectedInstanceId,
  canCreateCampaigns = true,
  selectedAgreementId = null,
}) => {
  const [agreementFilter, setAgreementFilter] = useState('all');
  const [instanceFilter, setInstanceFilter] = useState('all');
  const hasAgreementContext = Boolean(agreementName);

  const availableAgreements = useMemo(() => {
    const map = new Map();
    campaigns.forEach((campaign) => {
      const value = campaign.agreementId ?? NO_AGREEMENT_VALUE;
      if (map.has(value)) {
        return;
      }
      map.set(value, {
        value,
        label: formatAgreementLabel(campaign),
      });
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  }, [campaigns]);

  useEffect(() => {
    if (agreementFilter === 'all' && selectedAgreementId) {
      const exists = availableAgreements.some((item) => item.value === selectedAgreementId);
      if (exists) {
        setAgreementFilter(selectedAgreementId);
        setInstanceFilter('all');
      }
    }
  }, [agreementFilter, availableAgreements, selectedAgreementId]);

  useEffect(() => {
    if (
      agreementFilter !== 'all' &&
      !availableAgreements.some((item) => item.value === agreementFilter)
    ) {
      setAgreementFilter('all');
    }
  }, [agreementFilter, availableAgreements]);

  const handleAgreementFilterChange = (value) => {
    setAgreementFilter(value);
    setInstanceFilter('all');
  };

  const matchesAgreement = (campaign) => {
    if (agreementFilter === 'all') {
      return true;
    }
    if (agreementFilter === NO_AGREEMENT_VALUE) {
      return !campaign.agreementId;
    }
    return campaign.agreementId === agreementFilter;
  };

  const filteredCampaigns = useMemo(
    () =>
      campaigns.filter((campaign) => {
        if (!matchesAgreement(campaign)) {
          return false;
        }
        if (instanceFilter === 'all') {
          return true;
        }
        if (instanceFilter === NO_INSTANCE_VALUE) {
          return !campaign.instanceId;
        }
        return campaign.instanceId === instanceFilter;
      }),
    [campaigns, agreementFilter, instanceFilter]
  );

  const availableInstances = useMemo(() => {
    const source =
      agreementFilter === 'all'
        ? campaigns
        : campaigns.filter((campaign) => matchesAgreement(campaign));
    const map = new Map();
    source.forEach((campaign) => {
      const value = campaign.instanceId ?? NO_INSTANCE_VALUE;
      if (map.has(value)) {
        return;
      }
      const baseLabel = campaign.instanceId
        ? campaign.instanceName || campaign.instanceId
        : 'Sem instância vinculada';
      const label =
        agreementFilter === 'all' && campaign.instanceId
          ? `${baseLabel} • ${formatAgreementLabel(campaign)}`
          : baseLabel;
      map.set(value, {
        value,
        label,
        sortKey: label.toLowerCase(),
      });
    });
    return Array.from(map.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey, 'pt-BR'));
  }, [campaigns, agreementFilter]);

  useEffect(() => {
    if (
      instanceFilter !== 'all' &&
      !availableInstances.some((item) => item.value === instanceFilter)
    ) {
      setInstanceFilter('all');
    }
  }, [instanceFilter, availableInstances]);

  const totalCampaigns = filteredCampaigns.length;
  const activeCampaigns = filteredCampaigns.filter((entry) => entry.status === 'active').length;
  const isFiltered = agreementFilter !== 'all' || instanceFilter !== 'all';

  const isProcessing = (campaignId, type) =>
    Boolean(actionState?.id === campaignId && (!type || actionState.type === type));

  const renderEmptyState = () => (
    <div className="rounded-xl border border-dashed border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] p-6 text-center text-sm text-muted-foreground">
      <p>
        {isFiltered
          ? 'Nenhuma campanha corresponde aos filtros aplicados.'
          : hasAgreementContext
          ? 'Nenhuma campanha cadastrada para este convênio.'
          : 'Nenhuma campanha cadastrada até o momento.'}
      </p>
      <Button
        size="sm"
        className="mt-4"
        onClick={onCreateClick}
        disabled={!canCreateCampaigns}
      >
        <Plus className="mr-2 h-4 w-4" /> Criar campanha
      </Button>
    </div>
  );

  const groupedCampaigns = useMemo(() => {
    const map = new Map();
    filteredCampaigns.forEach((campaign) => {
      const key = campaign.agreementId ?? NO_AGREEMENT_VALUE;
      if (!map.has(key)) {
        map.set(key, {
          key,
          label: formatAgreementLabel(campaign),
          agreementId: campaign.agreementId ?? null,
          items: [],
        });
      }
      map.get(key).items.push(campaign);
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  }, [filteredCampaigns]);

  const renderCampaignCard = (campaign) => {
    const statusInfo = statusMeta[campaign.status] ?? {
      label: campaign.status,
      variant: 'secondary',
    };

    const isLinked = Boolean(campaign.instanceId);
    const highlight =
      campaign.instanceId && campaign.instanceId === (selectedInstanceId ?? null);
    const metrics = campaign.metrics ?? {};
    const isEnded = campaign.status === 'ended';
    const agreementLabel = formatAgreementLabel(campaign);
    const instanceLabel = isLinked
      ? campaign.instanceName || campaign.instanceId
      : 'Aguardando vínculo';

    return (
      <div
        key={campaign.id}
        className="space-y-4 rounded-xl border border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] p-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">{campaign.name}</p>
            <p className="text-xs text-muted-foreground">ID: {campaign.id}</p>
            <p className="text-xs text-muted-foreground">
              Convênio: {agreementLabel}
            </p>
            <p className="text-xs text-muted-foreground">
              Instância: {instanceLabel}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {highlight ? <Badge variant="info">Instância selecionada</Badge> : null}
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary">{agreementLabel}</Badge>
              </TooltipTrigger>
              <TooltipContent>Convênio que origina os leads desta campanha.</TooltipContent>
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
                  : 'Associe uma instância conectada para habilitar o roteamento automático de leads.'}
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
                {isLinked ? 'Reatribuir' : 'Vincular instância'}
              </Button>
            ) : null}
            {!isEnded && isLinked ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onDisconnect?.(campaign)}
                disabled={isProcessing(campaign.id)}
              >
                {isProcessing(campaign.id, 'reassign') ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Link2Off className="mr-2 h-4 w-4" />
                )}
                Desvincular
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
      <CardHeader className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle>Painel de campanhas</CardTitle>
            <CardDescription>
              {agreementName
                ? `Visão geral das campanhas do convênio ${agreementName}, com acesso rápido aos demais convênios e instâncias.`
                : 'Visão global de todas as campanhas vinculadas às instâncias de WhatsApp ativas.'}
            </CardDescription>
            {!canCreateCampaigns ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Vincule um convênio para habilitar a criação de campanhas.
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">{activeCampaigns} ativa(s)</Badge>
            <Badge variant="secondary">
              {totalCampaigns} {isFiltered ? 'filtrada(s)' : 'no total'}
            </Badge>
            <Button size="sm" variant="outline" onClick={onRefresh} disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="mr-2 h-4 w-4" />
              )}
              Atualizar
            </Button>
            <Button size="sm" onClick={onCreateClick} disabled={!canCreateCampaigns}>
              <Plus className="mr-2 h-4 w-4" /> Nova campanha
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="w-full sm:w-auto sm:min-w-[220px]">
            <Select value={agreementFilter} onValueChange={handleAgreementFilterChange}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os convênios" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os convênios</SelectItem>
                {availableAgreements.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full sm:w-auto sm:min-w-[220px]">
            <Select value={instanceFilter} onValueChange={setInstanceFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todas as instâncias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as instâncias</SelectItem>
                {availableInstances.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <NoticeBanner tone="error">
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

        {!loading && groupedCampaigns.length === 0 ? renderEmptyState() : null}

        {groupedCampaigns.length > 0 ? (
          <div className="space-y-6">
            {groupedCampaigns.map((group) => (
              <div key={group.key} className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{group.label}</p>
                    <Badge variant="secondary">{group.items.length} campanha(s)</Badge>
                  </div>
                  {group.agreementId ? (
                    <p className="text-xs text-muted-foreground">ID: {group.agreementId}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Convênio sem identificação</p>
                  )}
                </div>
                <div className="space-y-3">
                  {group.items.map((item) => renderCampaignCard(item))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

export default CampaignsPanel;
