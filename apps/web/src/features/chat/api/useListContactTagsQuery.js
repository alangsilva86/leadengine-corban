import { useQuery } from '@tanstack/react-query';

import { apiGet } from '@/lib/api.js';

export const useListContactTagsQuery = ({ enabled = true } = {}) => {
  return useQuery({
    queryKey: ['chat', 'contact-tags'],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const response = await apiGet('/api/contacts/tags');
      const data = response?.data ?? [];

      if (Array.isArray(data)) {
        return data;
      }

      if (Array.isArray(data?.items)) {
        return data.items;
      }

      return [];
    },
  });
};

export default useListContactTagsQuery;
