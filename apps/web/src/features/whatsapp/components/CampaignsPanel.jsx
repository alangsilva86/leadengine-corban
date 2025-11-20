import { useCallback, useMemo } from 'react';

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
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer.jsx';
import { Loader2, Plus, RefreshCcw } from 'lucide-react';

import CampaignCard from './CampaignCard.jsx';
import CampaignGroup from './CampaignGroup.jsx';
import { useCampaignFilters } from '../campaigns/hooks/useCampaignFilters.js';
import { useCampaignGroups } from '../campaigns/hooks/useCampaignGroups.js';
import { ALL_FILTER_VALUE } from '../campaigns/constants.js';

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
  const hasAgreementContext = Boolean(agreementName);

  const {
    agreementFilter,
    availableAgreements,
    availableInstances,
    filteredCampaigns,
    handleAgreementFilterChange,
    instanceFilter,
    isFiltered,
    setInstanceFilter,
  } = useCampaignFilters({ campaigns, selectedAgreementId });

  const groupedCampaigns = useCampaignGroups(filteredCampaigns);
  const activeFilters = useMemo(() => {
    let count = 0;
    if (agreementFilter !== ALL_FILTER_VALUE) count += 1;
    if (instanceFilter !== ALL_FILTER_VALUE) count += 1;
    return count;
  }, [agreementFilter, instanceFilter]);

  const { activeCampaigns, totalCampaigns } = useMemo(() => {
    const total = filteredCampaigns.length;
    const active = filteredCampaigns.filter((entry) => entry.status === 'active').length;
    return { activeCampaigns: active, totalCampaigns: total };
  }, [filteredCampaigns]);

  const isProcessing = useCallback(
    (campaignId, type) =>
      Boolean(actionState?.id === campaignId && (!type || actionState.type === type)),
    [actionState]
  );

  const renderEmptyState = useCallback(
    () => (
      <div className="rounded-xl border border-dashed border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] p-6 text-center text-sm text-muted-foreground">
        <p>
          {isFiltered
            ? 'Nenhuma campanha corresponde aos filtros aplicados.'
            : hasAgreementContext
            ? 'Nenhuma campanha cadastrada para esta origem.'
            : 'Nenhuma campanha cadastrada até o momento.'}
        </p>
      </div>
    ),
    [hasAgreementContext, isFiltered]
  );

  const resetFilters = useCallback(() => {
    handleAgreementFilterChange(ALL_FILTER_VALUE);
    setInstanceFilter(ALL_FILTER_VALUE);
  }, [handleAgreementFilterChange, setInstanceFilter]);

  return (
    <Card className="border border-[var(--border)]/60 bg-[rgba(15,23,42,0.45)]">
      <CardHeader className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <CardTitle>Painel de campanhas</CardTitle>
          <CardDescription>
            {agreementName
              ? `Visão geral das campanhas da origem ${agreementName}, com acesso rápido às demais origens e instâncias.`
              : 'Visão global de todas as campanhas vinculadas às instâncias de WhatsApp ativas.'}
          </CardDescription>
          {!canCreateCampaigns ? (
            <p className="text-xs text-muted-foreground">
              Conecte uma instância e defina uma origem quando quiser ativar campanhas automatizadas.
            </p>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="sticky top-0 z-[1] space-y-3 rounded-xl border border-[var(--border)]/70 bg-[rgba(15,23,42,0.75)] p-4 backdrop-blur">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="info">{activeCampaigns} ativa(s)</Badge>
            <Badge variant="secondary">
              {totalCampaigns} {isFiltered ? 'filtrada(s)' : 'no total'}
            </Badge>
            {activeFilters > 0 ? (
              <Badge variant="outline" className="text-[0.65rem] uppercase tracking-wide">
                {activeFilters} filtro(s)
              </Badge>
            ) : null}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Use os atalhos abaixo para criar novas campanhas ou abrir filtros adicionais.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={onCreateClick} disabled={!canCreateCampaigns}>
                <Plus className="mr-2 h-4 w-4" /> Nova campanha
              </Button>
              <Drawer>
                <DrawerTrigger asChild>
                  <Button size="sm" variant="outline">
                    Filtros e atualização
                  </Button>
                </DrawerTrigger>
                <DrawerContent className="pb-6">
                  <DrawerHeader className="pb-2">
                    <DrawerTitle>Filtrar e atualizar campanhas</DrawerTitle>
                    <p className="text-sm text-muted-foreground">
                      Ajuste a lista ou recarregue os dados conforme necessário.
                    </p>
                  </DrawerHeader>
                  <div className="space-y-4 px-4">
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Origem</p>
                      <Select value={agreementFilter} onValueChange={handleAgreementFilterChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Todas as origens" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ALL_FILTER_VALUE}>Todas as origens</SelectItem>
                          {availableAgreements.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Instância</p>
                      <Select value={instanceFilter} onValueChange={setInstanceFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="Todas as instâncias" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ALL_FILTER_VALUE}>Todas as instâncias</SelectItem>
                          {availableInstances.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {isFiltered ? (
                        <Button size="sm" variant="ghost" onClick={resetFilters}>
                          Limpar filtros
                        </Button>
                      ) : null}
                      <Button size="sm" variant="secondary" onClick={onRefresh} disabled={loading}>
                        {loading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCcw className="mr-2 h-4 w-4" />
                        )}
                        Atualizar lista
                      </Button>
                      <DrawerClose asChild>
                        <Button size="sm" variant="outline">
                          Fechar
                        </Button>
                      </DrawerClose>
                    </div>
                  </div>
                </DrawerContent>
              </Drawer>
            </div>
          </div>
        </div>

        <NoticeBanner tone="info">
          <p>Selecione uma instância e ative o roteamento para acompanhar suas campanhas.</p>
        </NoticeBanner>

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
              <CampaignGroup
                key={group.key}
                agreementId={group.agreementId}
                count={group.items.length}
                label={group.label}
              >
                {group.items.map((item) => (
                  <CampaignCard
                    key={item.id}
                    campaign={item}
                    isProcessing={isProcessing}
                    onActivate={onActivate}
                    onDelete={onDelete}
                    onDisconnect={onDisconnect}
                    onPause={onPause}
                    onReassign={onReassign}
                    selectedInstanceId={selectedInstanceId}
                  />
                ))}
              </CampaignGroup>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

export default CampaignsPanel;
