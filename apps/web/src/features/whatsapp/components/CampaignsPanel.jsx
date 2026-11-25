import { Button } from '@/components/ui/button.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';

import CampaignCard from './CampaignCard.jsx';
import { useCampaignFilters } from '../campaigns/hooks/useCampaignFilters.js';
import { ALL_FILTER_VALUE, NO_INSTANCE_VALUE } from '../campaigns/constants.js';

/** Filtros só aparecem quando a lista passa deste tamanho. */
const CAMPAIGN_FILTERS_THRESHOLD = 6;

/**
 * Lista de regras em cartões. Sem cabeçalho próprio, CTAs ou avisos:
 * isso fica na página, para não duplicar ações.
 */
const CampaignsPanel = ({
  campaigns,
  numbersById,
  actionState = null,
  onPause,
  onResume,
  onChangeNumber,
  onRename,
  onHistory,
  onEnd,
}) => {
  const {
    agreementFilter,
    availableAgreements,
    availableInstances,
    filteredCampaigns,
    handleAgreementFilterChange,
    instanceFilter,
    isFiltered,
    setInstanceFilter,
  } = useCampaignFilters({ campaigns, selectedAgreementId: null });

  const showFilters = campaigns.length > CAMPAIGN_FILTERS_THRESHOLD;
  const visible = showFilters ? filteredCampaigns : campaigns;

  const resolveNumberLabel = (option) => {
    if (option.value === NO_INSTANCE_VALUE) return 'Sem número';
    return numbersById?.get(option.value)?.name ?? option.label;
  };

  return (
    <section aria-label="Regras de roteamento" className="space-y-4">
      {showFilters ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select value={agreementFilter} onValueChange={handleAgreementFilterChange}>
            <SelectTrigger className="w-full sm:w-56" aria-label="Filtrar por origem">
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
          <Select value={instanceFilter} onValueChange={setInstanceFilter}>
            <SelectTrigger className="w-full sm:w-56" aria-label="Filtrar por número">
              <SelectValue placeholder="Todos os números" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FILTER_VALUE}>Todos os números</SelectItem>
              {availableInstances.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {resolveNumberLabel(item)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isFiltered ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                handleAgreementFilterChange(ALL_FILTER_VALUE);
                setInstanceFilter(ALL_FILTER_VALUE);
              }}
            >
              Limpar filtros
            </Button>
          ) : null}
        </div>
      ) : null}

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
          Nenhuma regra com esses filtros.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {visible.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              number={campaign.instanceId ? numbersById?.get(campaign.instanceId) ?? null : null}
              busyAction={actionState?.id === campaign.id ? actionState.type : null}
              onPause={onPause}
              onResume={onResume}
              onChangeNumber={onChangeNumber}
              onRename={onRename}
              onHistory={onHistory}
              onEnd={onEnd}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default CampaignsPanel;
