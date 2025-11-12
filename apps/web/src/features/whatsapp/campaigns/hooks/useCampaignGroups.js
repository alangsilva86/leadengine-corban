import { useMemo } from 'react';

import { NO_AGREEMENT_VALUE } from '../constants.js';
import { formatAgreementLabel } from '../../utils/campaign-formatters.js';

export const useCampaignGroups = (campaigns) =>
  useMemo(() => {
    const map = new Map();

    campaigns.forEach((campaign) => {
      const key = campaign.agreementId ?? NO_AGREEMENT_VALUE;
      if (!map.has(key)) {
        map.set(key, {
          agreementId: campaign.agreementId ?? null,
          items: [],
          key,
          label: formatAgreementLabel(campaign),
        });
      }
      map.get(key).items.push(campaign);
    });

    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  }, [campaigns]);
