import { createEntityUpdateMutation } from './createEntityUpdateMutation';

type Lead = {
  id?: string | number;
};

type LeadPayload = Record<string, unknown>;

type LeadHookParams = {
  leadId?: string | number;
};

type LeadMutationVariables = {
  targetLeadId?: string | number;
  data: LeadPayload;
};

export const useUpdateLeadField = createEntityUpdateMutation<
  Lead,
  LeadPayload,
  'leadId',
  'targetLeadId'
>({
  entityName: 'lead',
  baseEndpoint: '/api/leads',
  mutationKey: ['chat', 'lead-update'],
  entityCacheKey: 'leads',
  defaultIdKey: 'leadId',
  targetIdKey: 'targetLeadId',
});

export type UpdateLeadFieldMutation = ReturnType<typeof useUpdateLeadField>;
export type UpdateLeadFieldVariables = LeadMutationVariables;
export type UpdateLeadFieldParams = LeadHookParams;

export default useUpdateLeadField;
