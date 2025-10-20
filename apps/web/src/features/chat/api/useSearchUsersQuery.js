import { useQuery } from '@tanstack/react-query';

import { apiGet } from '@/lib/api.js';

const buildUsersQueryString = (search) => {
  const params = new URLSearchParams();
  params.set('limit', '20');
  if (typeof search === 'string' && search.trim().length > 0) {
    params.set('search', search.trim());
  }
  return params.toString();
};

export const useSearchUsersQuery = ({ search = '', enabled = true } = {}) => {
  return useQuery({
    queryKey: ['chat', 'users-search', search],
    enabled,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const queryString = buildUsersQueryString(search);
      const response = await apiGet(`/api/users${queryString ? `?${queryString}` : ''}`);
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

export default useSearchUsersQuery;
