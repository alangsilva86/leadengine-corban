import { useQuery } from '@tanstack/react-query';

import { apiGet } from '@/lib/api.js';

const buildCampaignQuery = (search) => {
  const params = new URLSearchParams();
  params.set('limit', '25');
  params.set('status', 'active,paused,draft');
  if (typeof search === 'string' && search.trim().length > 0) {
    params.set('search', search.trim());
  }
  return params.toString();
};

export const useCampaignsLookupQuery = ({ search = '', enabled = true } = {}) => {
  return useQuery({
    queryKey: ['chat', 'campaigns-lookup', search],
    enabled,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const queryString = buildCampaignQuery(search);
      const response = await apiGet(`/api/campaigns?${queryString}`);
      const data = response?.data ?? null;

      if (Array.isArray(data?.items)) {
        return data.items;
      }

      if (Array.isArray(data)) {
        return data;
      }

      return [];
    },
  });
};

export default useCampaignsLookupQuery;
