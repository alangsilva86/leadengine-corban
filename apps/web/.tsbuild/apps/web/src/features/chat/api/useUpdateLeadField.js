import { createEntityUpdateMutation } from './createEntityUpdateMutation';
export const useUpdateLeadField = createEntityUpdateMutation({
    entityName: 'lead',
    baseEndpoint: '/api/leads',
    mutationKey: ['chat', 'lead-update'],
    entityCacheKey: 'leads',
    defaultIdKey: 'leadId',
    targetIdKey: 'targetLeadId',
});
export default useUpdateLeadField;
