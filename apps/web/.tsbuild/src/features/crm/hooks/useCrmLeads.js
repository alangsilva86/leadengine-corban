import { useInfiniteQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api.js';
import { serializeCrmFilters } from '../utils/filter-serialization';
const fallbackLeads = Array.from({ length: 12 }).map((_, index) => ({
    id: `lead-demo-${index + 1}`,
    name: `Lead exemplo ${index + 1}`,
    stage: index % 3 === 0 ? 'qualification' : index % 3 === 1 ? 'proposal' : 'negotiation',
    ownerId: index % 2 === 0 ? 'owner:me' : 'owner:team',
    ownerName: index % 2 === 0 ? 'Você' : 'Equipe',
    lastActivityAt: new Date(Date.now() - index * 3600 * 1000).toISOString(),
    source: 'web',
    channel: 'whatsapp',
    potentialValue: 5000 + index * 250,
    status: 'in_progress',
}));
const fetchLeadsPage = async (filters, cursor) => {
    try {
        const params = new URLSearchParams({
            filters: serializeCrmFilters(filters),
        });
        if (cursor) {
            params.set('cursor', cursor);
        }
        const response = await apiGet(`/api/crm/leads?${params.toString()}`);
        const payload = response?.data ?? response;
        if (payload && typeof payload === 'object') {
            const items = Array.isArray(payload.items) ? payload.items : [];
            const nextCursor = typeof payload.nextCursor === 'string' ? payload.nextCursor : null;
            const total = typeof payload.total === 'number' ? payload.total : null;
            if (items.length > 0) {
                return { items, nextCursor, total };
            }
        }
    }
    catch (error) {
        console.warn('[CRM] Falha ao carregar leads', error);
    }
    return {
        items: fallbackLeads,
        nextCursor: null,
        total: fallbackLeads.length,
    };
};
export const useCrmLeads = (filters) => {
    const query = useInfiniteQuery({
        queryKey: ['crm', 'leads', serializeCrmFilters(filters)],
        queryFn: ({ pageParam }) => fetchLeadsPage(filters, pageParam ?? null),
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        staleTime: 15 * 1000,
        gcTime: 5 * 60 * 1000,
    });
    const items = query.data?.pages.flatMap((page) => page.items) ?? [];
    const total = query.data?.pages[0]?.total ?? null;
    return {
        leads: items,
        total,
        isLoading: query.isLoading,
        isFetching: query.isFetching,
        isFetchingNextPage: query.isFetchingNextPage,
        error: query.error instanceof Error ? query.error : null,
        fetchNextPage: query.fetchNextPage,
        hasNextPage: query.hasNextPage,
        refetch: query.refetch,
    };
};
export default useCrmLeads;
