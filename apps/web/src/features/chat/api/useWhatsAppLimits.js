import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api.js';

const buildPath = () => {
  const params = new URLSearchParams();
  params.set('limit', '1');
  params.set('metrics', 'true');
  params.set('include', 'lead');
  params.set('state', 'open');
  return `/api/tickets?${params.toString()}`;
};

export const useWhatsAppLimits = ({ enabled = true, staleTime = 15000 } = {}) => {
  return useQuery({
    queryKey: ['chat', 'whatsapp-limits'],
    enabled,
    staleTime,
    queryFn: async () => {
      const payload = await apiGet(buildPath());
      const data = payload?.data ?? null;
      const metrics = data?.metrics ?? null;
      const quality = metrics?.whatsappQuality ?? null;

      return {
        metrics,
        quality,
      };
    },
  });
};

export default useWhatsAppLimits;
