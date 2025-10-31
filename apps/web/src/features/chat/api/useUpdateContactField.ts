import { createEntityUpdateMutation } from './createEntityUpdateMutation';

type Contact = {
  id?: string | number;
};

type ContactPayload = Record<string, unknown>;

type ContactHookParams = {
  contactId?: string | number;
};

type ContactMutationVariables = {
  targetContactId?: string | number;
  data: ContactPayload;
};

export const useUpdateContactField = createEntityUpdateMutation<
  Contact,
  ContactPayload,
  'contactId',
  'targetContactId'
>({
  entityName: 'contact',
  baseEndpoint: '/api/contacts',
  mutationKey: ['chat', 'contact-update'],
  entityCacheKey: 'contacts',
  defaultIdKey: 'contactId',
  targetIdKey: 'targetContactId',
});

export type UpdateContactFieldMutation = ReturnType<typeof useUpdateContactField>;
export type UpdateContactFieldVariables = ContactMutationVariables;
export type UpdateContactFieldParams = ContactHookParams;

export default useUpdateContactField;
