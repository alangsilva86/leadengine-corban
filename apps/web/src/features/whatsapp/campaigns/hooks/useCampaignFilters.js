import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  ALL_FILTER_VALUE,
  NO_AGREEMENT_VALUE,
  NO_INSTANCE_VALUE,
} from '../constants.js';
import { formatAgreementLabel } from '../../utils/campaign-formatters.js';

const toInstanceLabel = (campaign, agreementFilter) => {
  const baseLabel = campaign.instanceId
    ? campaign.instanceName || campaign.instanceId
    : 'Sem instância vinculada';

  if (agreementFilter === ALL_FILTER_VALUE && campaign.instanceId) {
    return `${baseLabel} • ${formatAgreementLabel(campaign)}`;
  }

  return baseLabel;
};

export const useCampaignFilters = ({ campaigns, selectedAgreementId }) => {
  const [agreementFilter, setAgreementFilter] = useState(ALL_FILTER_VALUE);
  const [instanceFilter, setInstanceFilter] = useState(ALL_FILTER_VALUE);

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
    if (agreementFilter === ALL_FILTER_VALUE && selectedAgreementId) {
      const exists = availableAgreements.some((item) => item.value === selectedAgreementId);
      if (exists) {
        setAgreementFilter(selectedAgreementId);
        setInstanceFilter(ALL_FILTER_VALUE);
      }
    }
  }, [agreementFilter, availableAgreements, selectedAgreementId]);

  useEffect(() => {
    if (
      agreementFilter !== ALL_FILTER_VALUE &&
      !availableAgreements.some((item) => item.value === agreementFilter)
    ) {
      setAgreementFilter(ALL_FILTER_VALUE);
    }
  }, [agreementFilter, availableAgreements]);

  const matchesAgreement = useCallback(
    (campaign) => {
      if (agreementFilter === ALL_FILTER_VALUE) {
        return true;
      }
      if (agreementFilter === NO_AGREEMENT_VALUE) {
        return !campaign.agreementId;
      }
      return campaign.agreementId === agreementFilter;
    },
    [agreementFilter]
  );

  const filteredCampaigns = useMemo(
    () =>
      campaigns.filter((campaign) => {
        if (!matchesAgreement(campaign)) {
          return false;
        }
        if (instanceFilter === ALL_FILTER_VALUE) {
          return true;
        }
        if (instanceFilter === NO_INSTANCE_VALUE) {
          return !campaign.instanceId;
        }
        return campaign.instanceId === instanceFilter;
      }),
    [campaigns, instanceFilter, matchesAgreement]
  );

  const availableInstances = useMemo(() => {
    const source =
      agreementFilter === ALL_FILTER_VALUE
        ? campaigns
        : campaigns.filter((campaign) => matchesAgreement(campaign));

    const map = new Map();
    source.forEach((campaign) => {
      const value = campaign.instanceId ?? NO_INSTANCE_VALUE;
      if (map.has(value)) {
        return;
      }

      const label = toInstanceLabel(campaign, agreementFilter);

      map.set(value, {
        value,
        label,
        sortKey: label.toLowerCase(),
      });
    });

    return Array.from(map.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey, 'pt-BR'));
  }, [agreementFilter, campaigns, matchesAgreement]);

  useEffect(() => {
    if (
      instanceFilter !== ALL_FILTER_VALUE &&
      !availableInstances.some((item) => item.value === instanceFilter)
    ) {
      setInstanceFilter(ALL_FILTER_VALUE);
    }
  }, [availableInstances, instanceFilter]);

  const handleAgreementFilterChange = useCallback((value) => {
    setAgreementFilter(value);
    setInstanceFilter(ALL_FILTER_VALUE);
  }, []);

  const isFiltered =
    agreementFilter !== ALL_FILTER_VALUE || instanceFilter !== ALL_FILTER_VALUE;

  return {
    agreementFilter,
    availableAgreements,
    availableInstances,
    filteredCampaigns,
    handleAgreementFilterChange,
    instanceFilter,
    isFiltered,
    setInstanceFilter,
  };
};
