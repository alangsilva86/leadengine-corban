import { createEntityUpdateMutation } from './createEntityUpdateMutation';
export const useUpdateContactField = createEntityUpdateMutation({
    entityName: 'contact',
    baseEndpoint: '/api/contacts',
    mutationKey: ['chat', 'contact-update'],
    entityCacheKey: 'contacts',
    defaultIdKey: 'contactId',
    targetIdKey: 'targetContactId',
});
export default useUpdateContactField;
